import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { dealEvents, deals, listings } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const transitionSchema = z.object({
  action: z.enum(["cancel", "mark_delivered", "confirm_received", "dispute"]),
  detail: z.string().trim().max(500).default(""),
});

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

    let nextStatus = deal.status;
    if (
      payload.action === "cancel" &&
      deal.status === "pending_wallet" &&
      deal.buyerId === user.id
    ) {
      nextStatus = "cancelled";
    } else if (
      payload.action === "mark_delivered" &&
      deal.status === "awaiting_delivery" &&
      deal.sellerId === user.id
    ) {
      nextStatus = "awaiting_delivery";
    } else if (
      payload.action === "confirm_received" &&
      deal.status === "awaiting_delivery" &&
      deal.buyerId === user.id
    ) {
      nextStatus = "fulfilled";
    } else if (
      payload.action === "dispute" &&
      deal.status === "awaiting_delivery"
    ) {
      nextStatus = "disputed";
    } else {
      return noStoreJson(
        { error: "That action is not allowed in the current deal state." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const updates = db
      .update(deals)
      .set({
        status: nextStatus,
        completedAt: nextStatus === "fulfilled" ? now : deal.completedAt,
        updatedAt: now,
      })
      .where(and(eq(deals.id, id), eq(deals.status, deal.status)));
    const event = db.insert(dealEvents).values({
      id: crypto.randomUUID(),
      dealId: id,
      actorUserId: user.id,
      type: payload.action,
      fromStatus: deal.status,
      toStatus: nextStatus,
      detail: payload.detail,
      createdAt: now,
    });
    if (nextStatus === "fulfilled") {
      await db.batch([
        updates,
        event,
        db
          .update(listings)
          .set({ status: "sold", updatedAt: now })
          .where(eq(listings.id, deal.listingId)),
      ]);
    } else {
      await db.batch([updates, event]);
    }
    return noStoreJson({ deal: { id, status: nextStatus } });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson({ error: "Deal action is invalid." }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
