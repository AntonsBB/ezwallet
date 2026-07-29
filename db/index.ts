import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

function bindings() {
  return env as typeof env & {
    DB?: D1Database;
    MEDIA?: R2Bucket;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_BOT_USERNAME?: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    MINI_APP_URL?: string;
    PLATFORM_FEE_ADDRESS?: string;
    ESCROW_ARBITRATOR_ADDRESS?: string;
    ESCROW_ARBITRATOR_TELEGRAM_ID?: string;
    TON_NETWORK?: string;
    TONCENTER_API_KEY?: string;
    RECONCILE_SECRET?: string;
    ENVIRONMENT?: string;
    SEED_DEMO_DATA?: string;
  };
}

type StringBindingName =
  | "TELEGRAM_BOT_TOKEN"
  | "TELEGRAM_BOT_USERNAME"
  | "TELEGRAM_WEBHOOK_SECRET"
  | "MINI_APP_URL"
  | "PLATFORM_FEE_ADDRESS"
  | "ESCROW_ARBITRATOR_ADDRESS"
  | "ESCROW_ARBITRATOR_TELEGRAM_ID"
  | "TON_NETWORK"
  | "TONCENTER_API_KEY"
  | "RECONCILE_SECRET"
  | "ENVIRONMENT"
  | "SEED_DEMO_DATA";

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

export function getMediaBucket() {
  const bucket = bindings().MEDIA;
  if (!bucket) {
    throw new Error(
      "Cloudflare R2 binding `MEDIA` is unavailable. Set the `r2` field in .openai/hosting.json to `MEDIA`."
    );
  }
  return bucket;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
