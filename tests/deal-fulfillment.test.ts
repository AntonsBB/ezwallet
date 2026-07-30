import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptDeliveryAddress,
  deliveryAddressSchema,
  encryptDeliveryAddress,
  fulfillmentModeForListingType,
  trackingUpdateSchema,
} from "../lib/deal-fulfillment";

const secret = Buffer.alloc(32, 7).toString("base64url");
const address = {
  recipientName: "Ada Lovelace",
  line1: "12 Example Street",
  line2: "Unit 4",
  city: "Riga",
  region: "Riga",
  postalCode: "LV-1001",
  countryCode: "lv",
  instructions: "Leave with reception.",
};

test("encrypts delivery details with per-deal authenticated context", async () => {
  const encrypted = await encryptDeliveryAddress(
    deliveryAddressSchema.parse(address),
    secret,
    "deal-one"
  );
  assert.match(encrypted, /^v1\./);
  assert.equal(encrypted.includes("Example Street"), false);
  assert.deepEqual(await decryptDeliveryAddress(encrypted, secret, "deal-one"), {
    ...address,
    countryCode: "LV",
  });
  await assert.rejects(
    () => decryptDeliveryAddress(encrypted, secret, "deal-two"),
    /operation failed|decrypt/i
  );
});

test("rejects malformed keys, envelopes, and unsafe tracking links", async () => {
  await assert.rejects(
    () =>
      encryptDeliveryAddress(
        deliveryAddressSchema.parse(address),
        "not-a-key",
        "deal-one"
      ),
    /key is invalid/
  );
  await assert.rejects(
    () => decryptDeliveryAddress("plaintext", secret, "deal-one"),
    /record is invalid/
  );
  assert.equal(
    trackingUpdateSchema.safeParse({
      carrier: "Example Post",
      trackingCode: "https://phishing.example/track",
    }).success,
    false
  );
});

test("keeps listing type and fulfillment mode aligned", () => {
  assert.equal(
    fulfillmentModeForListingType("physical", "shipping"),
    "shipping"
  );
  assert.equal(fulfillmentModeForListingType("physical", "pickup"), "pickup");
  assert.equal(fulfillmentModeForListingType("digital", "digital"), "digital");
  assert.equal(fulfillmentModeForListingType("service", "service"), "service");
  assert.throws(
    () => fulfillmentModeForListingType("digital", "shipping"),
    /digital delivery/
  );
});
