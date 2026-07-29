import { getBinding } from "@/db";

export function canonicalAppOrigin(fallback: string) {
  const configured = getBinding("MINI_APP_URL");
  if (!configured) return new URL(fallback).origin;

  const url = new URL(configured);
  if (url.protocol !== "https:") {
    throw new Error("MINI_APP_URL must use HTTPS.");
  }
  return url.origin;
}

export function telegramBotUrl() {
  const username = getBinding("TELEGRAM_BOT_USERNAME")?.replace(/^@/, "");
  return username ? `https://t.me/${username}` : undefined;
}
