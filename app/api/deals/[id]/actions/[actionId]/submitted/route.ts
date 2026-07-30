import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { dealChainActions, dealEvents, deals } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const submittedSchema = z.object({
  boc: z.string().min(20).max(200_000),
  traceId: z.string().uuid().optional(),
});

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("deal-action-submit", user.id, 30, 3600);
    const payload = submittedSchema.parse(await request.json());
    const { id, actionId } = await context.params;
    const db = getDb();
    const [action] = await db
      .select({
        id: dealChainActions.id,
        dealId: dealChainActions.dealId,
        actorUserId: dealChainActions.actorUserId,
        status: dealChainActions.status,
        kind: dealChainActions.kind,
        dealStatus: deals.status,
      })
      .from(dealChainActions)
      .innerJoin(deals, eq(deals.id, dealChainActions.dealId))
      .where(
        and(
          eq(dealChainActions.id, actionId),
          eq(dealChainActions.dealId, id),
          eq(dealChainActions.actorUserId, user.id),
          gte(
            dealChainActions.createdAt,
            new Date(Date.now() - 15 * 60 * 1000).toISOString()
          )
        )
      )
      .limit(1);
    if (!action) {
      return noStoreJson(
        { error: "Prepared escrow action not found." },
        { status: 404 }
      );
    }
    if (action.status === "submitted" || action.status === "confirmed") {
      return noStoreJson({
        action: { id: actionId, status: action.status },
        message:
          action.status === "confirmed"
            ? "Escrow action was already verified on-chain."
            : "Escrow action submission was already recorded.",
      });
    }
    if (action.status !== "prepared") {
      return noStoreJson(
        { error: "This escrow action is no longer awaiting submission." },
        { status: 409 }
      );
    }

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(payload.boc)
    );
    const submissionBocDigest = toHex(digest);
    const transactionRef =
      payload.traceId ?? `boc:${submissionBocDigest}`;
    const now = new Date().toISOString();
    const updated = await db
      .update(dealChainActions)
      .set({
        status: "submitted",
        transactionRef,
        submissionBocDigest,
        submittedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(dealChainActions.id, actionId),
          eq(dealChainActions.status, "prepared")
        )
      )
      .returning({ id: dealChainActions.id });
    if (!updated.length) {
      return noStoreJson(
        { error: "This escrow action is no longer awaiting submission." },
        { status: 409 }
      );
    }

    await db.batch([
      db.insert(dealEvents).values({
        id: `chain-action-submitted:${actionId}`,
        dealId: id,
        actorUserId: user.id,
        type: `chain_${action.kind}_submitted`,
        fromStatus: action.dealStatus,
        toStatus: action.dealStatus,
        detail: JSON.stringify({ actionId, submissionBocDigest }),
        createdAt: now,
      }).onConflictDoNothing(),
    ]);

    return noStoreJson({
      action: { id: actionId, status: "submitted" },
      message: "Escrow action submitted and awaiting on-chain verification.",
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: "Wallet result is invalid." },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}
