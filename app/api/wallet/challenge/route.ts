import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  accountIdentities,
  identityLinkTickets,
  users,
  walletAuthChallenges,
} from "@/db/schema";
import {
  authenticateOptionalRequest,
  authErrorResponse,
} from "@/lib/auth";
import {
  hashIdentityLinkToken,
  IDENTITY_LINK_TOKEN_PATTERN,
} from "@/lib/identity-link";
import {
  readBoundedTextBody,
  RequestBodyTooLargeError,
} from "@/lib/request-body";
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

const challengeRequestSchema = z.object({
  claimToken: z.string().regex(IDENTITY_LINK_TOKEN_PATTERN).optional(),
});

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
    const requestText = await readBoundedTextBody(request, 2_048);
    let requestBody: z.infer<typeof challengeRequestSchema> = {};
    if (requestText) {
      try {
        requestBody = challengeRequestSchema.parse(JSON.parse(requestText));
      } catch {
        return noStoreJson(
          { error: "Wallet sign-in request is malformed." },
          { status: 400 }
        );
      }
    }
    if (context && requestBody.claimToken) {
      return noStoreJson(
        { error: "Sign out before claiming a legacy profile." },
        { status: 409 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();
    let linkTicket:
      | {
          id: string;
          userId: number;
          sourceIdentityId: string;
          moderationStatus: "active" | "restricted" | "banned";
          walletAddress: string | null;
        }
      | undefined;
    if (requestBody.claimToken) {
      const secretHash = await hashIdentityLinkToken(requestBody.claimToken);
      [linkTicket] = await db
        .select({
          id: identityLinkTickets.id,
          userId: identityLinkTickets.userId,
          sourceIdentityId: identityLinkTickets.sourceIdentityId,
          moderationStatus: users.moderationStatus,
          walletAddress: users.walletAddress,
        })
        .from(identityLinkTickets)
        .innerJoin(
          accountIdentities,
          eq(accountIdentities.id, identityLinkTickets.sourceIdentityId)
        )
        .innerJoin(users, eq(users.id, identityLinkTickets.userId))
        .where(
          and(
            eq(identityLinkTickets.secretHash, secretHash),
            isNull(identityLinkTickets.usedAt),
            isNull(identityLinkTickets.exchangedChallengeId),
            gt(identityLinkTickets.expiresAt, now),
            eq(accountIdentities.userId, identityLinkTickets.userId),
            eq(accountIdentities.provider, "telegram"),
            eq(accountIdentities.namespace, "user"),
            isNull(accountIdentities.revokedAt)
          )
        )
        .limit(1);
      if (
        !linkTicket ||
        linkTicket.moderationStatus === "banned" ||
        linkTicket.walletAddress
      ) {
        return noStoreJson(
          { error: "This profile-claim link is invalid or expired." },
          { status: 409 }
        );
      }
      await enforceRateLimit(
        "wallet-profile-claim",
        `ticket:${linkTicket.id}`,
        5,
        600
      );
    }

    const challengeUserId = context?.user.id ?? linkTicket?.userId;
    if (challengeUserId && !linkTicket) {
      await db
        .update(walletAuthChallenges)
        .set({ usedAt: now })
        .where(
          and(
            eq(walletAuthChallenges.userId, challengeUserId),
            isNull(walletAuthChallenges.usedAt)
          )
        );
    }

    const challenge = randomChallenge();
    const challengeId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await db.insert(walletAuthChallenges).values({
      id: challengeId,
      userId: challengeUserId,
      linkTicketId: linkTicket?.id,
      payload: challenge,
      expiresAt,
    });
    if (linkTicket) {
      const [exchangedTicket] = await db
        .update(identityLinkTickets)
        .set({ exchangedChallengeId: challengeId })
        .where(
          and(
            eq(identityLinkTickets.id, linkTicket.id),
            eq(identityLinkTickets.userId, linkTicket.userId),
            eq(
              identityLinkTickets.sourceIdentityId,
              linkTicket.sourceIdentityId
            ),
            isNull(identityLinkTickets.usedAt),
            isNull(identityLinkTickets.exchangedChallengeId),
            gt(identityLinkTickets.expiresAt, now),
            sql`EXISTS (
              SELECT 1
              FROM ${accountIdentities}
              WHERE ${accountIdentities.id} = ${identityLinkTickets.sourceIdentityId}
                AND ${accountIdentities.userId} = ${identityLinkTickets.userId}
                AND ${accountIdentities.provider} = 'telegram'
                AND ${accountIdentities.namespace} = 'user'
                AND ${accountIdentities.revokedAt} IS NULL
            )`
          )
        )
        .returning({ id: identityLinkTickets.id });
      if (!exchangedTicket) {
        await db
          .update(walletAuthChallenges)
          .set({ usedAt: now })
          .where(eq(walletAuthChallenges.id, challengeId));
        return noStoreJson(
          { error: "This profile-claim link is invalid or expired." },
          { status: 409 }
        );
      }
    }
    return noStoreJson({
      challenge,
      expiresAt,
      intent: linkTicket
        ? "claim_legacy_profile"
        : context
          ? "verify_or_link"
          : "sign_in",
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestBodyTooLargeError) {
      return noStoreJson(
        { error: "Wallet sign-in request is too large." },
        { status: 413 }
      );
    }
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: "Wallet sign-in request is malformed." },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}
