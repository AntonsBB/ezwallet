import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { listings } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  ListingInputError,
  listingCreateSchema,
  mediaKeyBelongsToUser,
  prepareListingFields,
} from "@/lib/listing-input";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("listing-create", user.id, 20, 86400);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 16_384) {
      return noStoreJson(
        { error: "Listing is too large." },
        { status: 413 }
      );
    }
    const payload = listingCreateSchema.parse(await request.json());
    const prepared = prepareListingFields(payload);
    if (!mediaKeyBelongsToUser(payload.mediaKey, user.id)) {
      return noStoreJson(
        { error: "That listing image does not belong to your profile." },
        { status: 403 }
      );
    }

    const listing = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      ...prepared,
      imageUrl: payload.mediaKey ? `/api/media/${payload.mediaKey}` : null,
      mediaKey: payload.mediaKey ?? null,
    } as const;

    await getDb().insert(listings).values(listing);
    return noStoreJson({ listing }, { status: 201 });
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

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);
    const rows = await getDb()
      .select()
      .from(listings)
      .where(eq(listings.ownerId, user.id))
      .orderBy(desc(listings.createdAt));
    return noStoreJson({ listings: rows });
  } catch (error) {
    return authErrorResponse(error);
  }
}
