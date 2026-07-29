import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { listingFavorites, listings } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const favoriteSchema = z.object({
  listingId: z.string().uuid(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);
    const rows = await getDb()
      .select({ listingId: listingFavorites.listingId })
      .from(listingFavorites)
      .where(eq(listingFavorites.userId, user.id))
      .orderBy(desc(listingFavorites.createdAt))
      .limit(500);
    return noStoreJson({
      listingIds: rows.map(({ listingId }) => listingId),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("favorite-create", user.id, 240, 86_400);
    const payload = favoriteSchema.parse(await request.json());
    const db = getDb();
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(
        and(
          eq(listings.id, payload.listingId),
          eq(listings.status, "active")
        )
      )
      .limit(1);
    if (!listing) {
      return noStoreJson({ error: "Listing not found." }, { status: 404 });
    }

    await db
      .insert(listingFavorites)
      .values({ userId: user.id, listingId: listing.id })
      .onConflictDoNothing();
    return noStoreJson({ listingId: listing.id, saved: true });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: "Choose a valid listing to save." },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}
