import { z } from "zod";

export const fulfillmentModeSchema = z.enum([
  "shipping",
  "pickup",
  "digital",
  "service",
]);

const countryCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}$/, "Use a two-letter country code."));

export const deliveryAddressSchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(3).max(160),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(2).max(32),
  countryCode: countryCodeSchema,
  instructions: z.string().trim().max(240).optional(),
});

export const trackingUpdateSchema = z.object({
  carrier: z.string().trim().min(2).max(60),
  trackingCode: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .refine(
      (value) => !/^https?:\/\//i.test(value),
      "Enter the tracking code, not a link."
    )
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
      "Tracking code contains unsupported characters."
    ),
});

export type FulfillmentMode = z.infer<typeof fulfillmentModeSchema>;
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;

const keyPattern = /^[A-Za-z0-9_-]{43}$/;
const envelopePattern =
  /^v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{16,4096})$/;

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) =>
    character.charCodeAt(0)
  );
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function importEncryptionKey(secret: string) {
  if (!keyPattern.test(secret)) {
    throw new Error("Fulfillment encryption key is invalid.");
  }
  const rawKey = decodeBase64Url(secret);
  if (rawKey.byteLength !== 32) {
    throw new Error("Fulfillment encryption key must be 32 bytes.");
  }
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function additionalData(dealId: string) {
  return new TextEncoder().encode(`easywallet:deal-fulfillment:v1:${dealId}`);
}

export async function encryptDeliveryAddress(
  value: DeliveryAddress,
  secret: string,
  dealId: string
) {
  const address = deliveryAddressSchema.parse(value);
  const key = await importEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(address));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: additionalData(dealId),
      tagLength: 128,
    },
    key,
    plaintext
  );
  return `v1.${encodeBase64Url(iv)}.${encodeBase64Url(
    new Uint8Array(encrypted)
  )}`;
}

export async function decryptDeliveryAddress(
  envelope: string,
  secret: string,
  dealId: string
) {
  const match = envelope.match(envelopePattern);
  if (!match) throw new Error("Fulfillment record is invalid.");
  const key = await importEncryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64Url(match[1]),
      additionalData: additionalData(dealId),
      tagLength: 128,
    },
    key,
    decodeBase64Url(match[2])
  );
  return deliveryAddressSchema.parse(
    JSON.parse(new TextDecoder().decode(plaintext))
  );
}

export function fulfillmentModeForListingType(
  type: "physical" | "digital" | "service" | "job",
  requested?: FulfillmentMode
) {
  if (type === "physical") {
    if (requested === "shipping" || requested === "pickup") return requested;
    throw new Error("Physical items must use shipping or pickup.");
  }
  if (type === "digital") {
    if (requested === "digital") return requested;
    throw new Error("Digital products must use digital delivery.");
  }
  if (requested === "service") return requested;
  throw new Error("Work and services must use service fulfillment.");
}
