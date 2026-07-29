import { eq } from "drizzle-orm";
import { getBinding, getDb } from "@/db";
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

export async function authenticateRequest(
  request: Request
): Promise<AuthenticatedUser> {
  const db = getDb();

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
      city: "",
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
      "This Easy Wallet profile has been suspended.",
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
