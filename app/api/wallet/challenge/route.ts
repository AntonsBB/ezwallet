import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { walletAuthChallenges } from "@/db/schema";
import {
  authenticateOptionalRequest,
  authErrorResponse,
} from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";
import {
  anonymousRequestKey,
  sessionRequestHasSafeOrigin,
} from "@/lib/session-security";

function randomChallenge() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(request: Request) {
  try {
    if (!sessionRequestHasSafeOrigin(request)) {
      return noStoreJson(
        { error: "The wallet sign-in origin could not be verified." },
        { status: 403 }
      );
    }
    const context = await authenticateOptionalRequest(request);
    const rateLimitSubject = context
      ? `user:${context.user.id}`
      : `anonymous:${await anonymousRequestKey(request)}`;
    await enforceRateLimit("wallet-challenge", rateLimitSubject, 8, 300);
    const db = getDb();
    const now = new Date().toISOString();
    if (context) {
      await db
        .update(walletAuthChallenges)
        .set({ usedAt: now })
        .where(
          and(
            eq(walletAuthChallenges.userId, context.user.id),
            isNull(walletAuthChallenges.usedAt)
          )
        );
    }

    const challenge = randomChallenge();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await db.insert(walletAuthChallenges).values({
      id: crypto.randomUUID(),
      userId: context?.user.id,
      payload: challenge,
      expiresAt,
    });
    return noStoreJson({
      challenge,
      expiresAt,
      intent: context ? "verify_or_link" : "sign_in",
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return authErrorResponse(error);
  }
}
