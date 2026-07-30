import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getBinding, getDb } from "@/db";
import { dealEvents, dealFulfillments, deals } from "@/db/schema";
import {
  authenticateRequest,
  AuthenticationError,
  authErrorResponse,
} from "@/lib/auth";
import {
  decryptDeliveryAddress,
  trackingUpdateSchema,
} from "@/lib/deal-fulfillment";
import {
  mayAddShippingTracking,
  mayViewDeliveryAddress,
} from "@/lib/fulfillment-policy";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";
import {
  readBoundedTextBody,
  RequestBodyTooLargeError,
} from "@/lib/request-body";

export const dynamic = "force-dynamic";

async function findParticipantFulfillment(dealId: string) {
  const [record] = await getDb()
    .select({
      dealId: deals.id,
      buyerId: deals.buyerId,
      sellerId: deals.sellerId,
      status: deals.status,
      escrowStatus: deals.escrowStatus,
      mode: dealFulfillments.mode,
      deliveryAddressCiphertext:
        dealFulfillments.deliveryAddressCiphertext,
      carrier: dealFulfillments.carrier,
      trackingCode: dealFulfillments.trackingCode,
      shippedAt: dealFulfillments.shippedAt,
      updatedAt: dealFulfillments.updatedAt,
    })
    .from(deals)
    .innerJoin(dealFulfillments, eq(dealFulfillments.dealId, deals.id))
    .where(eq(deals.id, dealId))
    .limit(1);
  return record;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("fulfillment-read", user.id, 60, 3600);
    const { id } = await context.params;
    const fulfillment = await findParticipantFulfillment(id);
    if (
      !fulfillment ||
      (fulfillment.buyerId !== user.id && fulfillment.sellerId !== user.id)
    ) {
      return noStoreJson({ error: "Deal not found." }, { status: 404 });
    }

    let deliveryAddress = null;
    const addressMayBeViewed = mayViewDeliveryAddress({
      actorUserId: user.id,
      buyerId: fulfillment.buyerId,
      sellerId: fulfillment.sellerId,
      escrowStatus: fulfillment.escrowStatus,
    });
    if (
      fulfillment.mode === "shipping" &&
      fulfillment.deliveryAddressCiphertext &&
      addressMayBeViewed
    ) {
      const encryptionKey = getBinding("DEAL_DATA_ENCRYPTION_KEY");
      if (!encryptionKey) {
        return noStoreJson(
          { error: "Private delivery details are temporarily unavailable." },
          { status: 503 }
        );
      }
      deliveryAddress = await decryptDeliveryAddress(
        fulfillment.deliveryAddressCiphertext,
        encryptionKey,
        fulfillment.dealId
      );
    }

    return noStoreJson({
      fulfillment: {
        mode: fulfillment.mode,
        deliveryAddress,
        addressAvailable:
          fulfillment.mode !== "shipping" ||
          Boolean(deliveryAddress) ||
          Boolean(fulfillment.deliveryAddressCiphertext),
        addressVisible:
          fulfillment.mode !== "shipping" || Boolean(deliveryAddress),
        carrier: fulfillment.carrier,
        trackingCode: fulfillment.trackingCode,
        shippedAt: fulfillment.shippedAt,
        updatedAt: fulfillment.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error(
      JSON.stringify({
        message: "fulfillment_read_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return noStoreJson(
      { error: "Fulfillment details could not be loaded." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("fulfillment-update", user.id, 20, 3600);
    const { id } = await context.params;
    const fulfillment = await findParticipantFulfillment(id);
    if (!fulfillment || fulfillment.sellerId !== user.id) {
      return noStoreJson({ error: "Deal not found." }, { status: 404 });
    }
    const rawBody = await readBoundedTextBody(request, 4_096);
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return noStoreJson(
        { error: "Tracking update is invalid." },
        { status: 400 }
      );
    }
    const payload = trackingUpdateSchema.parse(json);
    if (
      !mayAddShippingTracking({
        actorUserId: user.id,
        sellerId: fulfillment.sellerId,
        dealStatus: fulfillment.status,
        escrowStatus: fulfillment.escrowStatus,
        mode: fulfillment.mode,
      })
    ) {
      return noStoreJson(
        {
          error:
            "Tracking can be added only by the seller after escrow funding is confirmed.",
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const db = getDb();
    const [updatedFulfillment] = await db
      .update(dealFulfillments)
      .set({
        carrier: payload.carrier,
        trackingCode: payload.trackingCode,
        shippedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(dealFulfillments.dealId, id),
          eq(dealFulfillments.mode, "shipping"),
          sql`EXISTS (
            SELECT 1
            FROM ${deals}
            WHERE ${deals.id} = ${dealFulfillments.dealId}
              AND ${deals.sellerId} = ${user.id}
              AND ${deals.status} = 'awaiting_delivery'
              AND ${deals.escrowStatus} = 'funded'
          )`
        )
      )
      .returning({
        mode: dealFulfillments.mode,
        carrier: dealFulfillments.carrier,
        trackingCode: dealFulfillments.trackingCode,
        shippedAt: dealFulfillments.shippedAt,
        updatedAt: dealFulfillments.updatedAt,
      });
    if (!updatedFulfillment) {
      return noStoreJson(
        {
          error:
            "The deal state changed before tracking could be saved. Refresh and try again.",
        },
        { status: 409 }
      );
    }
    await db.insert(dealEvents).values({
      id: crypto.randomUUID(),
      dealId: id,
      actorUserId: user.id,
      type: "shipping_tracking_added",
      fromStatus: "awaiting_delivery",
      toStatus: "awaiting_delivery",
      detail: JSON.stringify({ trackingAdded: true }),
      createdAt: now,
    });

    return noStoreJson({
      fulfillment: {
        mode: updatedFulfillment.mode,
        carrier: updatedFulfillment.carrier,
        trackingCode: updatedFulfillment.trackingCode,
        shippedAt: updatedFulfillment.shippedAt,
        updatedAt: updatedFulfillment.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestBodyTooLargeError) {
      return noStoreJson(
        { error: "Tracking update is too large." },
        { status: 413 }
      );
    }
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: error.issues[0]?.message ?? "Tracking update is invalid." },
        { status: 400 }
      );
    }
    if (error instanceof AuthenticationError) return authErrorResponse(error);
    console.error(
      JSON.stringify({
        message: "fulfillment_update_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return noStoreJson(
      { error: "Tracking details could not be saved." },
      { status: 500 }
    );
  }
}
