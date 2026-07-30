import { and, eq, isNull } from "drizzle-orm";
import { getBinding, getDb } from "@/db";
import {
  accountIdentities,
  identityLinkTickets,
  users,
} from "@/db/schema";
import {
  buildIdentityClaimUrl,
  createIdentityLinkToken,
  hashIdentityLinkToken,
} from "@/lib/identity-link";
import {
  constantTimeTextEqual,
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
} from "@/lib/security";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number; type?: string };
    text?: string;
    from?: { id?: number; first_name?: string };
  };
};

type TelegramReplyMarkup = {
  inline_keyboard: Array<
    Array<{
      text: string;
      url?: string;
      web_app?: { url: string };
    }>
  >;
};

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: TelegramReplyMarkup
) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    }
  );
  if (!response.ok) {
    console.error(
      JSON.stringify({
        message: "telegram_send_failed",
        status: response.status,
      })
    );
  }
  return response.ok;
}

export async function POST(request: Request) {
  const botToken = getBinding("TELEGRAM_BOT_TOKEN");
  const webhookSecret = getBinding("TELEGRAM_WEBHOOK_SECRET");
  if (!botToken || !webhookSecret) {
    return noStoreJson({ error: "Bot is not configured." }, { status: 503 });
  }

  const providedSecret =
    request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!(await constantTimeTextEqual(providedSecret, webhookSecret))) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 64_000) {
    return noStoreJson({ error: "Update is too large." }, { status: 413 });
  }

  const requestText = await request.text();
  if (requestText.length > 64_000) {
    return noStoreJson({ error: "Update is too large." }, { status: 413 });
  }
  let update: TelegramUpdate;
  try {
    update = JSON.parse(requestText) as TelegramUpdate;
  } catch {
    return noStoreJson({ error: "Update is malformed." }, { status: 400 });
  }
  const chatId = update.message?.chat?.id;
  const chatType = update.message?.chat?.type;
  const telegramUserId = update.message?.from?.id;
  const text = update.message?.text ?? "";
  const command = text.split(/\s+/, 1)[0]?.split("@", 1)[0]?.toLowerCase();
  if (
    !chatId ||
    !["/start", "/help", "/safety", "/claim"].includes(command)
  ) {
    return noStoreJson({ ok: true });
  }

  const appUrl = getBinding("MINI_APP_URL") ?? new URL(request.url).origin;
  const firstName = update.message?.from?.first_name?.slice(0, 64) ?? "there";
  if (command === "/claim") {
    if (
      !telegramUserId ||
      chatType !== "private" ||
      chatId !== telegramUserId
    ) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "For your security, request a profile-claim link in a private chat with Easy Wallet."
      );
      return noStoreJson({ ok: true });
    }

    const db = getDb();
    const [legacyIdentity] = await db
      .select({
        identityId: accountIdentities.id,
        userId: accountIdentities.userId,
        walletAddress: users.walletAddress,
        moderationStatus: users.moderationStatus,
      })
      .from(accountIdentities)
      .innerJoin(users, eq(users.id, accountIdentities.userId))
      .where(
        and(
          eq(accountIdentities.provider, "telegram"),
          eq(accountIdentities.namespace, "user"),
          eq(accountIdentities.subject, String(telegramUserId)),
          isNull(accountIdentities.revokedAt)
        )
      )
      .limit(1);
    if (
      !legacyIdentity ||
      legacyIdentity.moderationStatus === "banned"
    ) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "No claimable legacy Easy Wallet profile is linked to this Telegram account."
      );
      return noStoreJson({ ok: true });
    }
    if (legacyIdentity.walletAddress) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "This legacy profile already has a verified wallet. Sign in with that wallet in Easy Wallet."
      );
      return noStoreJson({ ok: true });
    }

    try {
      await enforceRateLimit(
        "telegram-profile-claim",
        telegramUserId,
        3,
        3_600
      );
    } catch (error) {
      if (!(error instanceof RateLimitError)) throw error;
      await sendTelegramMessage(
        botToken,
        chatId,
        "Too many profile-claim links were requested. Please try again later."
      );
      return noStoreJson({ ok: true });
    }

    const now = new Date().toISOString();
    await db
      .update(identityLinkTickets)
      .set({ usedAt: now })
      .where(
        and(
          eq(identityLinkTickets.userId, legacyIdentity.userId),
          isNull(identityLinkTickets.usedAt)
        )
      );
    const claimToken = createIdentityLinkToken();
    const ticketId = crypto.randomUUID();
    await db.insert(identityLinkTickets).values({
      id: ticketId,
      userId: legacyIdentity.userId,
      sourceIdentityId: legacyIdentity.identityId,
      secretHash: await hashIdentityLinkToken(claimToken),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    const claimUrl = buildIdentityClaimUrl(appUrl, claimToken);
    const delivered = await sendTelegramMessage(
      botToken,
      chatId,
      "Use this one-time link within 10 minutes, then prove control of your wallet. Easy Wallet will never ask for a seed phrase or private key.",
      {
        inline_keyboard: [
          [
            {
              text: "Claim legacy profile",
              url: claimUrl,
            },
          ],
        ],
      }
    );
    if (!delivered) {
      await db
        .update(identityLinkTickets)
        .set({ usedAt: new Date().toISOString() })
        .where(eq(identityLinkTickets.id, ticketId));
      return noStoreJson(
        { error: "Telegram delivery failed." },
        { status: 502 }
      );
    }
    return noStoreJson({ ok: true });
  }

  const message =
    command === "/safety"
      ? "Easy Wallet never needs your recovery phrase or private key. Check every recipient and amount in your wallet before approving, and keep deals inside the app so the escrow state can be verified."
      : command === "/help"
        ? "Use Market for goods and Work for local services. Connect your own TON wallet, agree the deal terms, and approve each testnet transaction in your wallet. Easy Wallet never takes custody of your keys."
        : `Hi ${firstName} — welcome to Easy Wallet. Buy, sell and find local work using your own TON wallet. The public launch is currently on TON testnet.`;
  const delivered = await sendTelegramMessage(botToken, chatId, message, {
    inline_keyboard: [
      [
        {
          text: "Open Easy Wallet",
          web_app: { url: appUrl },
        },
      ],
    ],
  });
  if (!delivered) {
    return noStoreJson(
      { error: "Telegram delivery failed." },
      { status: 502 }
    );
  }

  return noStoreJson({ ok: true });
}
