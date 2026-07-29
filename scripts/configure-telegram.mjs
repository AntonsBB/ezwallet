const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const miniAppUrl = process.env.MINI_APP_URL;

if (!token || !webhookSecret || !miniAppUrl) {
  throw new Error(
    "Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and MINI_APP_URL."
  );
}

const origin = new URL(miniAppUrl).origin;
if (!origin.startsWith("https://")) {
  throw new Error("MINI_APP_URL must be a production HTTPS URL.");
}

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description ?? response.status}`);
  }
}

await telegram("setWebhook", {
  url: `${origin}/api/telegram/webhook`,
  secret_token: webhookSecret,
  allowed_updates: ["message"],
  drop_pending_updates: false,
});
await telegram("setChatMenuButton", {
  menu_button: {
    type: "web_app",
    text: "Open EzWallet",
    web_app: { url: origin },
  },
});

process.stdout.write("Telegram webhook and menu button configured.\n");
