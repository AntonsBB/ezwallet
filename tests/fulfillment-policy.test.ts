import assert from "node:assert/strict";
import test from "node:test";
import {
  mayAddShippingTracking,
  mayViewDeliveryAddress,
  shippingTrackingRequiredBeforeDelivery,
} from "../lib/fulfillment-policy";

test("keeps a buyer address hidden from the seller until funding is verified", () => {
  assert.equal(
    mayViewDeliveryAddress({
      actorUserId: 2,
      buyerId: 1,
      sellerId: 2,
      escrowStatus: "awaiting_funding",
    }),
    false
  );
  assert.equal(
    mayViewDeliveryAddress({
      actorUserId: 2,
      buyerId: 1,
      sellerId: 2,
      escrowStatus: "funded",
    }),
    true
  );
  assert.equal(
    mayViewDeliveryAddress({
      actorUserId: 99,
      buyerId: 1,
      sellerId: 2,
      escrowStatus: "funded",
    }),
    false
  );
});

test("allows tracking only from the funded shipping deal seller", () => {
  const allowed = {
    actorUserId: 2,
    sellerId: 2,
    dealStatus: "awaiting_delivery",
    escrowStatus: "funded" as const,
    mode: "shipping",
  };
  assert.equal(mayAddShippingTracking(allowed), true);
  assert.equal(
    mayAddShippingTracking({ ...allowed, actorUserId: 1 }),
    false
  );
  assert.equal(
    mayAddShippingTracking({ ...allowed, escrowStatus: "awaiting_funding" }),
    false
  );
  assert.equal(mayAddShippingTracking({ ...allowed, mode: "pickup" }), false);
});

test("requires a tracking code before shipped goods can be marked delivered", () => {
  assert.equal(
    shippingTrackingRequiredBeforeDelivery({
      mode: undefined,
      trackingCode: undefined,
    }),
    true
  );
  assert.equal(
    shippingTrackingRequiredBeforeDelivery({
      mode: "shipping",
      trackingCode: null,
    }),
    true
  );
  assert.equal(
    shippingTrackingRequiredBeforeDelivery({
      mode: "shipping",
      trackingCode: "TRACK-123",
    }),
    false
  );
  assert.equal(
    shippingTrackingRequiredBeforeDelivery({
      mode: "digital",
      trackingCode: null,
    }),
    false
  );
});
