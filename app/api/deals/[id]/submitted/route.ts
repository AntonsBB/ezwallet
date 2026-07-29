import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { dealEvents, deals, ledgerEntries } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const buyer = await authenticateRequest(request);
    await enforceRateLimit("deal-submit", buyer.id, 20, 3600);
    const { id } = await context.params;
    const payload = submittedSchema.parse(await request.json());
    const db = getDb();
    const [deal] = await db
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.id, id),
          eq(deals.buyerId, buyer.id)
        )
      )
      .limit(1);

    if (!deal) {
      return Response.json(
        { error: "Pending deal not found." },
        { status: 404 }
      );
    }
    if (
      deal.status === "payment_submitted" ||
      (deal.status === "awaiting_delivery" && deal.escrowStatus === "funded")
    ) {
      return Response.json({
        deal: {
          id,
          status: deal.status,
          transactionRef: deal.transactionRef,
        },
        message:
          deal.status === "awaiting_delivery"
            ? "Escrow funding was already verified on-chain."
            : "Wallet submission was already recorded.",
      });
    }
    if (
      deal.status !== "pending_wallet" ||
      deal.escrowStatus !== "awaiting_funding"
    ) {
      return Response.json(
        { error: "This funding request is no longer awaiting submission." },
        { status: 409 }
      );
    }

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(payload.boc)
    );
    const transactionRef = payload.traceId ?? `boc:${toHex(digest)}`;
    const paymentBocDigest = toHex(digest);
    const now = new Date().toISOString();

    const updated = await db
      .update(deals)
      .set({
        status: "payment_submitted",
        transactionRef,
        paymentBocDigest,
        submittedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(deals.id, id),
          eq(deals.status, "pending_wallet"),
          eq(deals.escrowStatus, "awaiting_funding")
        )
      )
      .returning({ id: deals.id });
    if (!updated.length) {
      return Response.json(
        { error: "This funding request is no longer awaiting submission." },
        { status: 409 }
      );
    }

    await db.batch([
      db
        .update(ledgerEntries)
        .set({
          status: "submitted",
          transactionRef,
          updatedAt: now,
        })
        .where(eq(ledgerEntries.dealId, id)),
      db.insert(dealEvents).values({
        id: `wallet-submission:${id}`,
        dealId: id,
        actorUserId: buyer.id,
        type: "wallet_submission_recorded",
        fromStatus: "pending_wallet",
        toStatus: "payment_submitted",
        detail: JSON.stringify({ paymentBocDigest }),
        createdAt: now,
      }).onConflictDoNothing(),
    ]);

    return Response.json({
      deal: {
        id,
        status: "payment_submitted",
        transactionRef,
      },
      message:
        "Wallet submission recorded. Escrow deployment and funding still require on-chain confirmation.",
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Wallet result is invalid." }, { status: 400 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("Telegram") ||
        error.message.includes("preview user"))
    ) {
      return authErrorResponse(error);
    }
    return Response.json(
      { error: "The wallet submission could not be recorded." },
      { status: 500 }
    );
  }
}
