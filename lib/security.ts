import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";

const encoder = new TextEncoder();

export function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function constantTimeTextEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  return constantTimeEqual(
    new Uint8Array(leftHash),
    new Uint8Array(rightHash)
  );
}

export async function enforceRateLimit(
  scope: string,
  userId: number,
  limit: number,
  windowSeconds: number
) {
  const db = getDb();
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();
  const key = `${scope}:${userId}`;
  const [current] = await db
    .select()
    .from(rateLimits)
    .where(
      and(eq(rateLimits.key, key), gt(rateLimits.resetAt, now.toISOString()))
    )
    .limit(1);

  if (!current) {
    await db
      .insert(rateLimits)
      .values({ key, count: 1, resetAt })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: 1, resetAt },
      });
    return;
  }

  if (current.count >= limit) {
    throw new RateLimitError(
      Math.max(1, Math.ceil((Date.parse(current.resetAt) - now.getTime()) / 1000))
    );
  }

  await db
    .update(rateLimits)
    .set({ count: sql`${rateLimits.count} + 1` })
    .where(eq(rateLimits.key, key));
}

export class RateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super("Too many requests.");
  }
}

export function rateLimitResponse(error: RateLimitError) {
  return Response.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: { "retry-after": String(error.retryAfter) },
    }
  );
}

export function noStoreJson(value: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return Response.json(value, { ...init, headers });
}
