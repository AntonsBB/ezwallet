export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

export type ValidatedTelegramInitData = {
  user: TelegramUser;
  authDate: number;
  queryId?: string;
};

const MAX_INIT_DATA_AGE_SECONDS = 60 * 60;
const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, value: string) {
  const rawKey = key instanceof Uint8Array ? Uint8Array.from(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

async function safeEqualHex(provided: string, expected: string) {
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = left.byteLength ^ right.byteLength;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function validateTelegramInitData(
  rawInitData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<ValidatedTelegramInitData> {
  if (!rawInitData || rawInitData.length > 8192) {
    throw new Error("Telegram init data is missing or too large.");
  }

  const parameters = new URLSearchParams(rawInitData);
  const providedHash = parameters.get("hash");
  const authDate = Number(parameters.get("auth_date"));
  const rawUser = parameters.get("user");

  if (!providedHash || !authDate || !rawUser) {
    throw new Error("Telegram init data is incomplete.");
  }

  if (
    authDate > nowSeconds + 30 ||
    nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS
  ) {
    throw new Error("Telegram init data has expired.");
  }

  const dataCheckString = Array.from(parameters.entries())
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await hmacSha256(
    encoder.encode("WebAppData"),
    botToken
  );
  const signature = toHex(await hmacSha256(secretKey, dataCheckString));

  if (!(await safeEqualHex(providedHash, signature))) {
    throw new Error("Telegram init data signature is invalid.");
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(rawUser) as TelegramUser;
  } catch {
    throw new Error("Telegram user data is invalid.");
  }

  if (
    !Number.isSafeInteger(user.id) ||
    !user.first_name ||
    user.first_name.length > 128
  ) {
    throw new Error("Telegram user data is invalid.");
  }

  return {
    user,
    authDate,
    queryId: parameters.get("query_id") ?? undefined,
  };
}

export async function timingSafeSecretEqual(
  provided: string,
  expected: string
) {
  return safeEqualHex(provided, expected);
}
