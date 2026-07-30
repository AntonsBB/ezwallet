import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { applications, deals, listings } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import { listingEditConflict } from "@/lib/listing-edit-policy";
import {
  ListingInputError,
  listingEditSchema,
  mediaKeyBelongsToUser,
  prepareListingFields,
} from "@/lib/listing-input";
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

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("listing-update", user.id, 60, 86_400);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 16_384) {
      return noStoreJson(
        { error: "Listing is too large." },
        { status: 413 }
      );
    }

    const { id: rawListingId } = await context.params;
    const listingId = listingIdSchema.parse(rawListingId);
    const payload = listingEditSchema.parse(await request.json());
    const db = getDb();
    const [listing] = await db
      .select({
        id: listings.id,
        section: listings.section,
        type: listings.type,
        status: listings.status,
        updatedAt: listings.updatedAt,
      })
      .from(listings)
      .where(
        and(eq(listings.id, listingId), eq(listings.ownerId, user.id))
      )
      .limit(1);
    if (!listing) {
      return noStoreJson({ error: "Listing not found." }, { status: 404 });
    }
    if (!mediaKeyBelongsToUser(payload.mediaKey, user.id)) {
      return noStoreJson(
        { error: "That listing image does not belong to your profile." },
        { status: 403 }
      );
    }

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
    const [openApplication] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.listingId, listing.id),
          inArray(applications.status, ["sent", "accepted"])
        )
      )
      .limit(1);
    const conflict = listingEditConflict(
      {
        ...listing,
        hasActiveDeal: Boolean(activeDeal),
        hasOpenApplication: Boolean(openApplication),
      },
      payload
    );
    if (conflict) {
      return noStoreJson(
        { error: conflict },
        { status: 409 }
      );
    }

    const prepared = prepareListingFields(payload);
    const updatedAt = new Date().toISOString();
    const replacementMedia = payload.mediaKey
      ? {
          mediaKey: payload.mediaKey,
          imageUrl: `/api/media/${payload.mediaKey}`,
        }
      : {};
    const [updated] = await db
      .update(listings)
      .set({
        ...prepared,
        ...replacementMedia,
        updatedAt,
      })
      .where(
        and(
          eq(listings.id, listing.id),
          eq(listings.ownerId, user.id),
          eq(listings.status, listing.status),
          eq(listings.updatedAt, listing.updatedAt)
        )
      )
      .returning();
    if (!updated) {
      return noStoreJson(
        { error: "The listing changed. Refresh and try again." },
        { status: 409 }
      );
    }
    return noStoreJson({ listing: updated });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof ListingInputError) {
      return noStoreJson({ error: error.message }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: error.issues[0]?.message ?? "Listing is invalid." },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}

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
