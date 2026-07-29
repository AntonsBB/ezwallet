import assert from "node:assert/strict";
import test from "node:test";
import { validateTelegramInitData } from "../lib/telegram.ts";

const encoder = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, value: string) {
  const rawKey = key instanceof Uint8Array ? Uint8Array.from(key) : key;
  const imported = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", imported, encoder.encode(value));
}

function hex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signedInitData(now: number, token: string) {
  const parameters = new URLSearchParams({
    auth_date: String(now),
    query_id: "AAE-test",
    signature: "telegram-third-party-signature",
    user: JSON.stringify({
      id: 42,
      first_name: "Anton",
      username: "anton",
    }),
  });
  const check = Array.from(parameters.entries())
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), token);
  parameters.set("hash", hex(await hmac(secret, check)));
  return parameters.toString();
}

test("accepts fresh Telegram Mini App data with the third-party signature field", async () => {
  const now = 1_800_000_000;
  const result = await validateTelegramInitData(
    await signedInitData(now, "123:secret"),
    "123:secret",
    now
  );
  assert.equal(result.user.id, 42);
  assert.equal(result.user.username, "anton");
});

test("rejects tampering and replayed init data", async () => {
  const now = 1_800_000_000;
  const valid = await signedInitData(now, "123:secret");
  await assert.rejects(
    validateTelegramInitData(valid.replace("Anton", "Mallory"), "123:secret", now),
    /signature/
  );
  await assert.rejects(
    validateTelegramInitData(valid, "123:secret", now + 3601),
    /expired/
  );
});
