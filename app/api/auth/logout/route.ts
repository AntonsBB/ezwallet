import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { authSessions } from "@/db/schema";
import {
  expiredSessionCookies,
  hashSessionToken,
  sessionRequestHasSafeOrigin,
  sessionTokenFromRequest,
} from "@/lib/session-security";

export async function POST(request: Request) {
  if (!sessionRequestHasSafeOrigin(request)) {
    return Response.json(
      { error: "The sign-out origin could not be verified." },
      { status: 403, headers: { "cache-control": "no-store" } }
    );
  }

  const token = sessionTokenFromRequest(request);
  if (token) {
    const sessionId = await hashSessionToken(token);
    await getDb()
      .update(authSessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(authSessions.id, sessionId));
  }

  const headers = new Headers({ "cache-control": "no-store" });
  for (const cookie of expiredSessionCookies()) {
    headers.append("set-cookie", cookie);
  }
  return new Response(null, { status: 204, headers });
}
