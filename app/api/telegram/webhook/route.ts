import { getBinding } from "@/db";
import { timingSafeSecretEqual } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    text?: string;
    from?: { first_name?: string };
  };
};

export async function POST(request: Request) {
  const botToken = getBinding("TELEGRAM_BOT_TOKEN");
  const webhookSecret = getBinding("TELEGRAM_WEBHOOK_SECRET");
  if (!botToken || !webhookSecret) {
    return Response.json({ error: "Bot is not configured." }, { status: 503 });
  }

  const providedSecret =
    request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!(await timingSafeSecretEqual(providedSecret, webhookSecret))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 64_000) {
    return Response.json({ error: "Update is too large." }, { status: 413 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const chatId = update.message?.chat?.id;
  const text = update.message?.text ?? "";
  if (!chatId || !text.startsWith("/start")) {
    return Response.json({ ok: true });
  }

  const appUrl = getBinding("MINI_APP_URL") ?? new URL(request.url).origin;
  const firstName = update.message?.from?.first_name?.slice(0, 64) ?? "there";
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Hi ${firstName} — welcome to EzWallet. Buy, sell, work and pay with your own TON wallet.`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Open EzWallet",
                web_app: { url: appUrl },
              },
            ],
          ],
        },
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
    return Response.json({ error: "Telegram delivery failed." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
