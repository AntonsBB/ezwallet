import { Address } from "@ton/core";
import { and, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { dealChainActions, deals } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  buildEscrowResolutionPayload,
  ESCROW_ACTION_VALUE_NANO,
  queryIdForDeal,
  textToUint256,
} from "@/lib/ton-escrow";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const resolutionSchema = z.object({
  releaseToSeller: z.boolean(),
  detail: z.string().trim().min(20).max(1_000),
});

function sameAddress(left: string, right: string) {
  try {
    return Address.parse(left).toRawString() === Address.parse(right).toRawString();
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const arbitrator = await authenticateRequest(request);
    await enforceRateLimit("escrow-resolution", arbitrator.id, 20, 3600);
    const payload = resolutionSchema.parse(await request.json());
    const { id } = await context.params;
    const db = getDb();
    const [deal] = await db
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.id, id),
          eq(deals.status, "disputed"),
          eq(deals.escrowStatus, "disputed")
        )
      )
      .limit(1);
    if (
      !deal?.escrowAddress ||
      !deal.arbitratorWalletAddress ||
      !arbitrator.walletAddress ||
      !arbitrator.walletVerifiedAt ||
      arbitrator.walletNetwork !== deal.network ||
      !sameAddress(arbitrator.walletAddress, deal.arbitratorWalletAddress)
    ) {
      return noStoreJson(
        { error: "Disputed escrow is unavailable to this arbitrator wallet." },
        { status: 404 }
      );
    }

    const [pending] = await db
      .select({ id: dealChainActions.id })
      .from(dealChainActions)
      .where(
        and(
          eq(dealChainActions.dealId, deal.id),
          inArray(dealChainActions.status, ["prepared", "submitted"]),
          gte(
            dealChainActions.createdAt,
            new Date(Date.now() - 15 * 60 * 1000).toISOString()
          )
        )
      )
      .limit(1);
    if (pending) {
      return noStoreJson(
        {
          error:
            "Another escrow action is awaiting wallet approval or confirming.",
        },
        { status: 409 }
      );
    }

    const actionId = crypto.randomUUID();
    const kind = payload.releaseToSeller
      ? ("resolve_release" as const)
      : ("resolve_refund" as const);
    const payloadBase64 = buildEscrowResolutionPayload(
      deal.id,
      payload.releaseToSeller
    );
    const detailHash = await textToUint256(
      `${kind}:${payload.detail}`
    );
    const now = new Date().toISOString();
    await db.insert(dealChainActions).values({
      id: actionId,
      dealId: deal.id,
      actorUserId: arbitrator.id,
      actorWalletAddress: arbitrator.walletAddress,
      kind,
      queryId: queryIdForDeal(deal.id).toString(),
      detailHash: detailHash.toString(),
      payloadBase64,
      messageValueNano: ESCROW_ACTION_VALUE_NANO.toString(),
      status: "prepared",
      createdAt: now,
      updatedAt: now,
    });

    return noStoreJson(
      {
        action: { id: actionId, kind, status: "prepared" },
        transaction: {
          validUntil: Math.floor(Date.now() / 1000) + 300,
          network: deal.network === "testnet" ? "-3" : "-239",
          from: arbitrator.walletAddress,
          messages: [
            {
              address: deal.escrowAddress,
              amount: ESCROW_ACTION_VALUE_NANO.toString(),
              payload: payloadBase64,
            },
          ],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: "Resolution decision is invalid." },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}
