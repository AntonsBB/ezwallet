import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getBinding, getDb } from "@/db";
import {
  accountIdentities,
  authSessions,
  identityLinkTickets,
  users,
  walletAuthChallenges,
} from "@/db/schema";
import { evaluateAccountIdentityBinding } from "@/lib/account-identity";
import { authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";
import {
  readBoundedTextBody,
  RequestBodyTooLargeError,
} from "@/lib/request-body";
import {
  anonymousRequestKey,
  createSessionToken,
  hashSessionToken,
  SESSION_MAX_AGE_SECONDS,
  sessionCookie,
  sessionRequestHasSafeOrigin,
} from "@/lib/session-security";
import { TonProofPayload, verifyTonProof } from "@/lib/ton-proof";

const proofSchema = z.object({
  address: z.string().min(3).max(80),
  network: z.enum(["-239", "-3"]),
  publicKey: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  walletStateInit: z.string().min(20).max(20_000),
  proof: z.object({
    timestamp: z.number().int().positive(),
    domain: z.object({
      lengthBytes: z.number().int().positive().max(255),
      value: z.string().min(1).max(255),
    }),
    signature: z.string().min(40).max(256),
    payload: z.string().min(20).max(256),
  }),
});

export async function POST(request: Request) {
  try {
    if (!sessionRequestHasSafeOrigin(request)) {
      return noStoreJson(
        { error: "The wallet sign-in origin could not be verified." },
        { status: 403 }
      );
    }
    await enforceRateLimit(
      "wallet-verify",
      `anonymous:${await anonymousRequestKey(request)}`,
      12,
      300
    );
    const requestText = await readBoundedTextBody(request, 32_000);
    let requestBody: unknown;
    try {
      requestBody = JSON.parse(requestText);
    } catch {
      return noStoreJson(
        { error: "Wallet proof is malformed." },
        { status: 400 }
      );
    }
    const payload = proofSchema.parse(requestBody);
    const db = getDb();
    const [challenge] = await db
      .select()
      .from(walletAuthChallenges)
      .where(
        and(
          eq(walletAuthChallenges.payload, payload.proof.payload),
          isNull(walletAuthChallenges.usedAt),
          gt(walletAuthChallenges.expiresAt, new Date().toISOString())
        )
      )
      .limit(1);
    if (!challenge) {
      return noStoreJson(
        { error: "Wallet proof challenge is missing or expired." },
        { status: 409 }
      );
    }

    const network =
      getBinding("TON_NETWORK") === "mainnet" ? "mainnet" : "testnet";
    let walletAddress: string;
    try {
      walletAddress = await verifyTonProof(
        payload as TonProofPayload,
        new URL(request.url).hostname,
        challenge.payload,
        network
      );
    } catch (error) {
      return noStoreJson(
        {
          error:
            error instanceof Error
              ? error.message
              : "Wallet proof could not be verified.",
        },
        { status: 400 }
      );
    }

    const verifiedAt = new Date().toISOString();
    if (challenge.linkTicketId) {
      const [linkTicket] = await db
        .select({
          id: identityLinkTickets.id,
          userId: identityLinkTickets.userId,
          sourceIdentityId: identityLinkTickets.sourceIdentityId,
        })
        .from(identityLinkTickets)
        .innerJoin(
          accountIdentities,
          eq(accountIdentities.id, identityLinkTickets.sourceIdentityId)
        )
        .where(
          and(
            eq(identityLinkTickets.id, challenge.linkTicketId),
            eq(identityLinkTickets.userId, challenge.userId ?? -1),
            eq(identityLinkTickets.exchangedChallengeId, challenge.id),
            isNull(identityLinkTickets.usedAt),
            gt(identityLinkTickets.expiresAt, verifiedAt),
            eq(accountIdentities.userId, identityLinkTickets.userId),
            eq(accountIdentities.provider, "telegram"),
            eq(accountIdentities.namespace, "user"),
            isNull(accountIdentities.revokedAt)
          )
        )
        .limit(1);
      if (!linkTicket) {
        return noStoreJson(
          { error: "This profile-claim link is invalid or expired." },
          { status: 409 }
        );
      }
    }

    const [claimedChallenge] = await db
      .update(walletAuthChallenges)
      .set({ usedAt: verifiedAt })
      .where(
        and(
          eq(walletAuthChallenges.id, challenge.id),
          isNull(walletAuthChallenges.usedAt)
        )
      )
      .returning({ id: walletAuthChallenges.id });
    if (!claimedChallenge) {
      return noStoreJson(
        { error: "Wallet proof challenge has already been used." },
        { status: 409 }
      );
    }

    const [walletIdentity] = await db
      .select({
        userId: accountIdentities.userId,
      })
      .from(accountIdentities)
      .where(
        and(
          eq(accountIdentities.provider, "ton"),
          eq(accountIdentities.namespace, network),
          eq(accountIdentities.subject, walletAddress),
          isNull(accountIdentities.revokedAt)
        )
      )
      .limit(1);
    const [walletOwner] = walletIdentity
      ? await db
          .select()
          .from(users)
          .where(eq(users.id, walletIdentity.userId))
          .limit(1)
      : [];

    let user = walletOwner;
    if (challenge.userId) {
      const [boundIdentity] = await db
        .select({
          subject: accountIdentities.subject,
          revokedAt: accountIdentities.revokedAt,
        })
        .from(accountIdentities)
        .where(
          and(
            eq(accountIdentities.userId, challenge.userId),
            eq(accountIdentities.provider, "ton"),
            eq(accountIdentities.namespace, network)
          )
        )
        .limit(1);
      const bindingDecision = evaluateAccountIdentityBinding({
        targetUserId: challenge.userId,
        subject: walletAddress,
        subjectOwnerUserId: walletOwner?.id,
        profileIdentity: boundIdentity,
      });
      if (!bindingDecision.allowed) {
        const message =
          bindingDecision.reason === "identity_owned_by_another_profile"
            ? "This wallet already belongs to another Easy Wallet profile. Sign in with that wallet first."
            : bindingDecision.reason === "profile_identity_revoked"
              ? "This profile wallet identity was revoked and requires support review."
              : "This profile is already bound to another wallet. Sign out and use that wallet to continue.";
        return noStoreJson(
          { error: message },
          { status: 409 }
        );
      }
      const [boundUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, challenge.userId))
        .limit(1);
      if (!boundUser) {
        return noStoreJson(
          { error: "The wallet profile no longer exists." },
          { status: 409 }
        );
      }
      if (
        boundUser.walletAddress &&
        (boundUser.walletAddress !== walletAddress ||
          boundUser.walletNetwork !== network)
      ) {
        return noStoreJson(
          {
            error:
              "This profile is already bound to another wallet. Sign out and use that wallet to continue.",
          },
          { status: 409 }
        );
      }
      if (challenge.linkTicketId) {
        const [claimedTicket] = await db
          .update(identityLinkTickets)
          .set({ usedAt: verifiedAt })
          .where(
            and(
              eq(identityLinkTickets.id, challenge.linkTicketId),
              eq(identityLinkTickets.userId, challenge.userId),
              eq(identityLinkTickets.exchangedChallengeId, challenge.id),
              isNull(identityLinkTickets.usedAt),
              gt(identityLinkTickets.expiresAt, verifiedAt),
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
        if (!claimedTicket) {
          return noStoreJson(
            { error: "This profile-claim link has already been used." },
            { status: 409 }
          );
        }
      }
      await db
        .insert(accountIdentities)
        .values({
          id: crypto.randomUUID(),
          userId: challenge.userId,
          provider: "ton",
          namespace: network,
          subject: walletAddress,
          proofMethod: "ton_proof",
          verifiedAt,
          updatedAt: verifiedAt,
        })
        .onConflictDoNothing();
      const [claimedIdentity] = await db
        .select({
          userId: accountIdentities.userId,
          subject: accountIdentities.subject,
          revokedAt: accountIdentities.revokedAt,
        })
        .from(accountIdentities)
        .where(
          and(
            eq(accountIdentities.userId, challenge.userId),
            eq(accountIdentities.provider, "ton"),
            eq(accountIdentities.namespace, network)
          )
        )
        .limit(1);
      if (
        !claimedIdentity ||
        claimedIdentity.subject !== walletAddress ||
        claimedIdentity.revokedAt
      ) {
        return noStoreJson(
          { error: "This wallet identity could not be linked safely." },
          { status: 409 }
        );
      }
      await db
        .update(users)
        .set({
          walletAddress,
          walletNetwork: network,
          walletVerifiedAt: verifiedAt,
          updatedAt: verifiedAt,
        })
        .where(eq(users.id, challenge.userId));
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, challenge.userId))
        .limit(1);
    } else if (!user) {
      const compactAddress = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
      try {
        [user] = await db
          .insert(users)
          .values({
            telegramId: null,
            displayName: `Wallet ${compactAddress}`,
            city: "",
            walletAddress,
            walletNetwork: network,
            walletVerifiedAt: verifiedAt,
          })
          .returning();
      } catch {
        [user] = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.walletNetwork, network),
              eq(users.walletAddress, walletAddress)
            )
          )
          .limit(1);
      }
    }
    if (!user) {
      throw new Error("Wallet profile could not be created.");
    }
    await db
      .insert(accountIdentities)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        provider: "ton",
        namespace: network,
        subject: walletAddress,
        proofMethod: "ton_proof",
        verifiedAt,
        updatedAt: verifiedAt,
      })
      .onConflictDoNothing();
    const [resolvedIdentity] = await db
      .select({
        userId: accountIdentities.userId,
        revokedAt: accountIdentities.revokedAt,
      })
      .from(accountIdentities)
      .where(
        and(
          eq(accountIdentities.provider, "ton"),
          eq(accountIdentities.namespace, network),
          eq(accountIdentities.subject, walletAddress)
        )
      )
      .limit(1);
    if (
      !resolvedIdentity ||
      resolvedIdentity.userId !== user.id ||
      resolvedIdentity.revokedAt
    ) {
      return noStoreJson(
        { error: "This wallet identity already belongs to another profile." },
        { status: 409 }
      );
    }
    if (user.moderationStatus === "banned") {
      return noStoreJson(
        { error: "This Easy Wallet profile has been suspended." },
        { status: 403 }
      );
    }

    const token = createSessionToken();
    const sessionId = await hashSessionToken(token);
    const expiresAt = new Date(
      Date.now() + SESSION_MAX_AGE_SECONDS * 1000
    ).toISOString();
    await db.insert(authSessions).values({
      id: sessionId,
      userId: user.id,
      authMethod: "wallet",
      expiresAt,
      lastSeenAt: verifiedAt,
    });
    return noStoreJson(
      {
        user,
        wallet: { address: walletAddress, network, verifiedAt },
        session: { method: "wallet", expiresAt },
      },
      {
        headers: {
          "set-cookie": sessionCookie(request, token),
        },
      }
    );
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestBodyTooLargeError) {
      return noStoreJson(
        { error: "Wallet proof is too large." },
        { status: 413 }
      );
    }
    if (error instanceof z.ZodError) {
      return noStoreJson({ error: "Wallet proof is malformed." }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
