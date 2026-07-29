import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getBinding, getDb } from "@/db";
import { authSessions, users, walletAuthChallenges } from "@/db/schema";
import { authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";
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
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 32_000) {
      return noStoreJson({ error: "Wallet proof is too large." }, { status: 413 });
    }
    const payload = proofSchema.parse(await request.json());
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

    const [walletOwner] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.walletNetwork, network),
          eq(users.walletAddress, walletAddress)
        )
      )
      .limit(1);

    let user = walletOwner;
    if (challenge.userId) {
      if (walletOwner && walletOwner.id !== challenge.userId) {
        return noStoreJson(
          {
            error:
              "This wallet already belongs to another Easy Wallet profile. Sign in with that wallet first.",
          },
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
    if (error instanceof z.ZodError) {
      return noStoreJson({ error: "Wallet proof is malformed." }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
