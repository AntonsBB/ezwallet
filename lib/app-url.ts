import { getBinding } from "@/db";

export function canonicalAppOrigin(fallback: string) {
  const configured = getBinding("MINI_APP_URL");
  if (!configured) return new URL(fallback).origin;

  const url = new URL(configured);
  const isLoopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  const isProduction = getBinding("ENVIRONMENT") === "production";
  if (url.protocol !== "https:" && (!isLoopback || isProduction)) {
    throw new Error(
      "MINI_APP_URL must use HTTPS outside local development."
    );
  }
  return url.origin;
}

export function telegramBotUrl() {
  const username = getBinding("TELEGRAM_BOT_USERNAME")?.replace(/^@/, "");
  return username ? `https://t.me/${username}` : undefined;
}
