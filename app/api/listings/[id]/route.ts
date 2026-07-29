import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { deals, listings } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  listingLifecycleActions,
  nextListingStatus,
  type ListingStatus,
} from "@/lib/listing-lifecycle";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const listingIdSchema = z.string().uuid();
const actionSchema = z.object({
  action: z.enum(listingLifecycleActions),
});

const activeDealStatuses = [
  "pending_wallet",
  "payment_submitted",
  "awaiting_delivery",
  "disputed",
] as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("listing-lifecycle", user.id, 100, 86_400);
    const { id: rawListingId } = await context.params;
    const listingId = listingIdSchema.parse(rawListingId);
    const { action } = actionSchema.parse(await request.json());
    const db = getDb();
    const [listing] = await db
      .select({
        id: listings.id,
        status: listings.status,
      })
      .from(listings)
      .where(
        and(eq(listings.id, listingId), eq(listings.ownerId, user.id))
      )
      .limit(1);
    if (!listing) {
      return noStoreJson({ error: "Listing not found." }, { status: 404 });
    }

    const nextStatus = nextListingStatus(
      listing.status as ListingStatus,
      action
    );
    if (!nextStatus) {
      return noStoreJson(
        { error: "That listing action is no longer available." },
        { status: 409 }
      );
    }

    if (action === "activate") {
      const [activeDeal] = await db
        .select({ id: deals.id })
        .from(deals)
        .where(
          and(
            eq(deals.listingId, listing.id),
            inArray(deals.status, activeDealStatuses)
          )
        )
        .limit(1);
      if (activeDeal) {
        return noStoreJson(
          { error: "A listing with an active deal cannot be reactivated." },
          { status: 409 }
        );
      }
    }

    const updatedAt = new Date().toISOString();
    const [updated] = await db
      .update(listings)
      .set({ status: nextStatus, updatedAt })
      .where(
        and(
          eq(listings.id, listing.id),
          eq(listings.ownerId, user.id),
          eq(listings.status, listing.status)
        )
      )
      .returning({
        id: listings.id,
        status: listings.status,
        updatedAt: listings.updatedAt,
      });
    if (!updated) {
      return noStoreJson(
        { error: "The listing changed. Refresh and try again." },
        { status: 409 }
      );
    }
    return noStoreJson({ listing: updated });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: "Choose a valid listing action." },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}
