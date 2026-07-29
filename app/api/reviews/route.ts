import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { deals, reviews, users } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const reviewSchema = z.object({
  dealId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(500).default(""),
});

export async function POST(request: Request) {
  try {
    const reviewer = await authenticateRequest(request);
    await enforceRateLimit("review-create", reviewer.id, 20, 86400);
    const payload = reviewSchema.parse(await request.json());
    const db = getDb();
    const [deal] = await db
      .select()
      .from(deals)
      .where(
        and(eq(deals.id, payload.dealId), eq(deals.status, "fulfilled"))
      )
      .limit(1);
    if (!deal || (deal.buyerId !== reviewer.id && deal.sellerId !== reviewer.id)) {
      return noStoreJson({ error: "Completed deal not found." }, { status: 404 });
    }
    const revieweeId =
      deal.buyerId === reviewer.id ? deal.sellerId : deal.buyerId;
    const now = new Date().toISOString();
    await db.batch([
      db.insert(reviews).values({
        id: crypto.randomUUID(),
        dealId: deal.id,
        reviewerId: reviewer.id,
        revieweeId,
        rating: payload.rating,
        body: payload.body,
        createdAt: now,
      }),
      db
        .update(users)
        .set({
          ratingMilli: sql`ROUND(((${users.ratingMilli} * ${users.reviewCount}) + ${payload.rating * 1000}) / (${users.reviewCount} + 1))`,
          reviewCount: sql`${users.reviewCount} + 1`,
          updatedAt: now,
        })
        .where(eq(users.id, revieweeId)),
    ]);
    return noStoreJson({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson({ error: "Review is invalid." }, { status: 400 });
    }
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      return noStoreJson(
        { error: "You already reviewed this deal." },
        { status: 409 }
      );
    }
    return authErrorResponse(error);
  }
}
