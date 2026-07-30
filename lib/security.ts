import { sql } from "drizzle-orm";
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
  subject: number | string,
  limit: number,
  windowSeconds: number
) {
  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();
  const key = `${scope}:${subject}`;
  const [current] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} <= ${nowIso} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= ${nowIso} THEN ${resetAt} ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning({
      count: rateLimits.count,
      resetAt: rateLimits.resetAt,
    });

  if (!current) {
    throw new Error("Rate limit counter could not be updated.");
  }
  if (current.count > limit) {
    throw new RateLimitError(
      Math.max(1, Math.ceil((Date.parse(current.resetAt) - now.getTime()) / 1000))
    );
  }
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
