import { eq } from "drizzle-orm";
import { getBinding, getDb } from "@/db";
import { ensureDatabase } from "@/db/init";
import { users } from "@/db/schema";
import { noStoreJson } from "./security";
import { validateTelegramInitData } from "./telegram";

export type AuthenticatedUser = typeof users.$inferSelect;

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 503 = 401
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

function isLocalPreview(request: Request) {
  const hostname = new URL(request.url).hostname;
  return (
    request.headers.get("x-ezwallet-demo") === "local-preview" &&
    (hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "terminal.local")
  );
}

export async function authenticateRequest(
  request: Request
): Promise<AuthenticatedUser> {
  await ensureDatabase();
  const db = getDb();

  if (isLocalPreview(request)) {
    const [demoUser] = await db.select().from(users).where(eq(users.id, 1)).limit(1);
    if (!demoUser) {
      throw new AuthenticationError("Local preview user is unavailable.");
    }
    return demoUser;
  }

  const botToken = getBinding("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    throw new AuthenticationError(
      "Telegram launch is not configured yet.",
      503
    );
  }

  const initData = request.headers.get("x-telegram-init-data") ?? "";
  let validated: Awaited<ReturnType<typeof validateTelegramInitData>>;
  try {
    validated = await validateTelegramInitData(initData, botToken);
  } catch {
    throw new AuthenticationError(
      "Telegram session is invalid or expired."
    );
  }
  const telegramId = String(validated.user.id);
  const displayName = [validated.user.first_name, validated.user.last_name]
    .filter(Boolean)
    .join(" ")
    .slice(0, 128);

  await db
    .insert(users)
    .values({
      telegramId,
      username: validated.user.username?.slice(0, 64),
      displayName,
      photoUrl: validated.user.photo_url?.slice(0, 1024),
    })
    .onConflictDoUpdate({
      target: users.telegramId,
      set: {
        username: validated.user.username?.slice(0, 64),
        displayName,
        photoUrl: validated.user.photo_url?.slice(0, 1024),
        updatedAt: new Date().toISOString(),
      },
    });

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  if (!user) {
    throw new Error("Telegram profile could not be created.");
  }
  if (user.moderationStatus === "banned") {
    throw new AuthenticationError(
      "This EzWallet profile has been suspended.",
      403
    );
  }
  return user;
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
