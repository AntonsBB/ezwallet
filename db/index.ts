import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

function bindings() {
  return env as typeof env & {
    DB?: D1Database;
    MEDIA?: KVNamespace;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_BOT_USERNAME?: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    MINI_APP_URL?: string;
    PLATFORM_FEE_ADDRESS?: string;
    ESCROW_ARBITRATOR_ADDRESS?: string;
    TON_NETWORK?: string;
    TONCENTER_API_KEY?: string;
    RECONCILE_SECRET?: string;
    DEAL_DATA_ENCRYPTION_KEY?: string;
    ENVIRONMENT?: string;
  };
}

type StringBindingName =
  | "TELEGRAM_BOT_TOKEN"
  | "TELEGRAM_BOT_USERNAME"
  | "TELEGRAM_WEBHOOK_SECRET"
  | "MINI_APP_URL"
  | "PLATFORM_FEE_ADDRESS"
  | "ESCROW_ARBITRATOR_ADDRESS"
  | "TON_NETWORK"
  | "TONCENTER_API_KEY"
  | "RECONCILE_SECRET"
  | "DEAL_DATA_ENCRYPTION_KEY"
  | "ENVIRONMENT";

export function getBinding(name: StringBindingName) {
  const value = bindings()[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getD1() {
  const database = bindings().DB;
  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB`."
    );
  }
  return database;
}

export function getMediaStore() {
  const store = bindings().MEDIA;
  if (!store) {
    throw new Error(
      "Cloudflare KV binding `MEDIA` is unavailable."
    );
  }
  return store;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
