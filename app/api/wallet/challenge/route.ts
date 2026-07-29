import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { walletChallenges } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

function randomChallenge() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("wallet-challenge", user.id, 6, 300);
    const db = getDb();
    const now = new Date().toISOString();
    await db
      .update(walletChallenges)
      .set({ usedAt: now })
      .where(
        and(
          eq(walletChallenges.userId, user.id),
          isNull(walletChallenges.usedAt)
        )
      );

    const challenge = randomChallenge();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await db.insert(walletChallenges).values({
      id: crypto.randomUUID(),
      userId: user.id,
      payload: challenge,
      expiresAt,
    });
    return noStoreJson({ challenge, expiresAt });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return authErrorResponse(error);
  }
}
