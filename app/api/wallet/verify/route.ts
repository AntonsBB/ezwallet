import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getBinding, getDb } from "@/db";
import { users, walletChallenges } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";
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
    const user = await authenticateRequest(request);
    await enforceRateLimit("wallet-verify", user.id, 8, 300);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 32_000) {
      return noStoreJson({ error: "Wallet proof is too large." }, { status: 413 });
    }
    const payload = proofSchema.parse(await request.json());
    const db = getDb();
    const [challenge] = await db
      .select()
      .from(walletChallenges)
      .where(
        and(
          eq(walletChallenges.userId, user.id),
          eq(walletChallenges.payload, payload.proof.payload),
          isNull(walletChallenges.usedAt),
          gt(walletChallenges.expiresAt, new Date().toISOString())
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
    const walletAddress = await verifyTonProof(
      payload as TonProofPayload,
      new URL(request.url).hostname,
      challenge.payload,
      network
    );
    const verifiedAt = new Date().toISOString();
    await db.batch([
      db
        .update(walletChallenges)
        .set({ usedAt: verifiedAt })
        .where(eq(walletChallenges.id, challenge.id)),
      db
        .update(users)
        .set({
          walletAddress,
          walletNetwork: network,
          walletVerifiedAt: verifiedAt,
          updatedAt: verifiedAt,
        })
        .where(eq(users.id, user.id)),
    ]);
    return noStoreJson({
      wallet: { address: walletAddress, network, verifiedAt },
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson({ error: "Wallet proof is malformed." }, { status: 400 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("Telegram") ||
        error.message.includes("profile has been suspended") ||
        error.message.includes("preview user"))
    ) {
      return authErrorResponse(error);
    }
    return noStoreJson(
      {
        error:
          error instanceof Error ? error.message : "Wallet proof failed.",
      },
      { status: 400 }
    );
  }
}
