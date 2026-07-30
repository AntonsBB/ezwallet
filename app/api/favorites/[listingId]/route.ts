import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { listingFavorites } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const listingIdSchema = z.string().uuid();

export async function DELETE(
  request: Request,
  context: { params: Promise<{ listingId: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("favorite-delete", user.id, 240, 86_400);
    const { listingId: rawListingId } = await context.params;
    const listingId = listingIdSchema.parse(rawListingId);
    await getDb()
      .delete(listingFavorites)
      .where(
        and(
          eq(listingFavorites.userId, user.id),
          eq(listingFavorites.listingId, listingId)
        )
      );
    return noStoreJson({ listingId, saved: false });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: "Choose a valid listing to remove." },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}
