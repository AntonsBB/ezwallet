import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { authSessions, users } from "@/db/schema";
import { noStoreJson } from "./security";
import {
  hashSessionToken,
  sessionRequestHasSafeOrigin,
  sessionTokenFromRequest,
} from "./session-security";

export type AuthenticatedUser = typeof users.$inferSelect;
export type AuthenticationMethod = "wallet";
export type AuthenticatedRequestContext = {
  user: AuthenticatedUser;
  method: AuthenticationMethod;
};

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 503 = 401
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

async function authenticateWalletSession(
  request: Request
): Promise<AuthenticatedRequestContext | null> {
  const token = sessionTokenFromRequest(request);
  if (!token) return null;
  if (!sessionRequestHasSafeOrigin(request)) {
    throw new AuthenticationError(
      "The wallet session origin could not be verified.",
      403
    );
  }

  const db = getDb();
  const sessionId = await hashSessionToken(token);
  const now = new Date().toISOString();
  const [session] = await db
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, sessionId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, now)
      )
    )
    .limit(1);
  if (!session) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return null;
  if (user.moderationStatus === "banned") {
    throw new AuthenticationError(
      "This Easy Wallet profile has been suspended.",
      403
    );
  }
  if (Date.parse(session.lastSeenAt) < Date.now() - 60 * 60 * 1000) {
    await db
      .update(authSessions)
      .set({ lastSeenAt: now })
      .where(eq(authSessions.id, session.id));
  }
  return { user, method: "wallet" };
}

export async function authenticateRequestContext(
  request: Request
): Promise<AuthenticatedRequestContext> {
  const walletSession = await authenticateWalletSession(request);
  if (walletSession) return walletSession;
  throw new AuthenticationError(
    "Connect and verify a wallet to continue."
  );
}

export async function authenticateOptionalRequest(request: Request) {
  const hasWalletCookie = Boolean(sessionTokenFromRequest(request));
  if (!hasWalletCookie) return null;
  try {
    return await authenticateRequestContext(request);
  } catch (error) {
    if (
      hasWalletCookie &&
      error instanceof AuthenticationError &&
      error.status === 401
    ) {
      return null;
    }
    throw error;
  }
}

export async function authenticateRequest(
  request: Request
): Promise<AuthenticatedUser> {
  return (await authenticateRequestContext(request)).user;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return noStoreJson({ error: error.message }, { status: error.status });
  }
  console.error(
    JSON.stringify({
      message: "authenticated_request_failed",
      error: error instanceof Error ? error.message : String(error),
    })
  );
  return noStoreJson(
    { error: "The request could not be completed." },
    { status: 500 }
  );
}
