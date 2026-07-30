import { Address } from "@ton/core";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  dealChainActions,
  dealFulfillments,
  deals,
} from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import { shippingTrackingRequiredBeforeDelivery } from "@/lib/fulfillment-policy";
import {
  buildEscrowActionPayload,
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

const transitionSchema = z.object({
  action: z.enum([
    "mark_delivered",
    "confirm_received",
    "dispute",
    "refund_expired",
    "release_after_review",
  ]),
  detail: z.string().trim().max(500).default(""),
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
    const user = await authenticateRequest(request);
    await enforceRateLimit("deal-transition", user.id, 30, 3600);
    const payload = transitionSchema.parse(await request.json());
    const { id } = await context.params;
    const db = getDb();
    const [deal] = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
    if (!deal || (deal.buyerId !== user.id && deal.sellerId !== user.id)) {
      return noStoreJson({ error: "Deal not found." }, { status: 404 });
    }

    if (
      !deal.escrowAddress ||
      deal.escrowStatus === "legacy" ||
      !user.walletAddress ||
      !user.walletVerifiedAt ||
      user.walletNetwork !== deal.network
    ) {
      return noStoreJson(
        { error: "Verify the wallet assigned to this escrow before acting." },
        { status: 409 }
      );
    }

    const isBuyer =
      user.id === deal.buyerId &&
      sameAddress(user.walletAddress, deal.buyerWalletAddress);
    const isSeller =
      user.id === deal.sellerId &&
      sameAddress(user.walletAddress, deal.sellerWalletAddress);
    if (
      payload.action === "mark_delivered" &&
      isSeller &&
      deal.status === "awaiting_delivery" &&
      deal.escrowStatus === "funded"
    ) {
      const [fulfillment] = await db
        .select({
          mode: dealFulfillments.mode,
          trackingCode: dealFulfillments.trackingCode,
        })
        .from(dealFulfillments)
        .where(eq(dealFulfillments.dealId, deal.id))
        .limit(1);
      if (!fulfillment) {
        return noStoreJson(
          {
            error:
              "Fulfillment details are missing. This deal cannot advance until support repairs the record.",
          },
          { status: 409 }
        );
      }
      if (shippingTrackingRequiredBeforeDelivery(fulfillment)) {
        return noStoreJson(
          {
            error:
              "Add the shipment tracking code before marking this item delivered.",
          },
          { status: 409 }
        );
      }
    }
    let chainKind:
      | "mark_delivered"
      | "confirm_received"
      | "open_dispute"
      | "refund_expired"
      | "release_after_review";

    if (
      payload.action === "mark_delivered" &&
      deal.status === "awaiting_delivery" &&
      deal.escrowStatus === "funded" &&
      isSeller
    ) {
      chainKind = "mark_delivered";
    } else if (
      payload.action === "confirm_received" &&
      deal.status === "awaiting_delivery" &&
      deal.escrowStatus === "delivered" &&
      isBuyer
    ) {
      chainKind = "confirm_received";
    } else if (
      payload.action === "dispute" &&
      deal.status === "awaiting_delivery" &&
      inArrayValue(deal.escrowStatus, ["funded", "delivered"]) &&
      (isBuyer || isSeller)
    ) {
      if (payload.detail.length < 10) {
        return noStoreJson(
          { error: "Describe the dispute in at least 10 characters." },
          { status: 400 }
        );
      }
      chainKind = "open_dispute";
    } else if (
      payload.action === "refund_expired" &&
      deal.status === "awaiting_delivery" &&
      deal.escrowStatus === "funded" &&
      isBuyer &&
      deal.deliveryDeadlineUnix !== null &&
      Math.floor(Date.now() / 1000) > deal.deliveryDeadlineUnix
    ) {
      chainKind = "refund_expired";
    } else if (
      payload.action === "release_after_review" &&
      deal.status === "awaiting_delivery" &&
      deal.escrowStatus === "delivered" &&
      (isBuyer || isSeller) &&
      deal.reviewDeadlineUnix !== null &&
      Math.floor(Date.now() / 1000) > deal.reviewDeadlineUnix
    ) {
      chainKind = "release_after_review";
    } else {
      return noStoreJson(
        { error: "That action is not allowed in the current escrow state." },
        { status: 409 }
      );
    }

    const [pendingAction] = await db
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
      .orderBy(desc(dealChainActions.createdAt))
      .limit(1);
    if (pendingAction) {
      return noStoreJson(
        {
          error:
            "Another escrow action is awaiting wallet approval or confirming on TON.",
        },
        { status: 409 }
      );
    }

    const detailHash = payload.detail
      ? await textToUint256(`${chainKind}:${payload.detail}`)
      : 0n;
    const payloadBase64 = buildEscrowActionPayload(
      deal.id,
      chainKind === "open_dispute" ? "dispute" : chainKind,
      detailHash
    );
    const actionId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(dealChainActions).values({
      id: actionId,
      dealId: deal.id,
      actorUserId: user.id,
      actorWalletAddress: user.walletAddress,
      kind: chainKind,
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
        action: { id: actionId, kind: chainKind, status: "prepared" },
        transaction: {
          validUntil: Math.floor(Date.now() / 1000) + 300,
          network: deal.network === "testnet" ? "-3" : "-239",
          from: user.walletAddress,
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
      return noStoreJson({ error: "Deal action is invalid." }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}

function inArrayValue<T extends string>(value: string, allowed: readonly T[]) {
  return allowed.includes(value as T);
}
