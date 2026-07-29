import assert from "node:assert/strict";
import test from "node:test";
import { Address } from "@ton/core";
import {
  inspectPaymentConfiguration,
  normalizeTonAddress,
} from "../lib/payment-configuration.ts";
import { paymentReadinessMessage } from "../lib/payment-readiness.ts";

const platform = new Address(0, Buffer.alloc(32, 0x51));
const arbitrator = new Address(0, Buffer.alloc(32, 0x52));

test("keeps payments blocked until every operational role is configured", () => {
  const result = inspectPaymentConfiguration({ network: "testnet" });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    "platform_wallet_missing",
    "arbitrator_wallet_missing",
    "arbitrator_operator_missing",
  ]);
  assert.equal(
    paymentReadinessMessage(result.blockers, result.network),
    "Payments are paused until the testnet platform fee wallet, arbitrator wallet and authorized arbitrator are configured."
  );
});

test("rejects malformed wallet and Telegram operator bindings", () => {
  const result = inspectPaymentConfiguration({
    network: "testnet",
    platformFeeAddress: "not-a-ton-address",
    arbitratorAddress: arbitrator.toString(),
    arbitratorTelegramId: "-123",
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    "platform_wallet_invalid",
    "arbitrator_operator_invalid",
  ]);
});

test("rejects one wallet reused for platform and arbitrator roles", () => {
  const result = inspectPaymentConfiguration({
    network: "testnet",
    platformFeeAddress: platform.toString(),
    arbitratorAddress: platform.toRawString(),
    arbitratorTelegramId: "123456789",
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ["wallet_roles_not_distinct"]);
});

test("normalizes valid, distinct addresses for the configured network", () => {
  const result = inspectPaymentConfiguration({
    network: "testnet",
    platformFeeAddress: platform.toRawString(),
    arbitratorAddress: arbitrator.toRawString(),
    arbitratorTelegramId: " 123456789 ",
  });

  assert.equal(result.ready, true);
  if (!result.ready) return;
  assert.deepEqual(result.blockers, []);
  assert.equal(
    result.platformWalletAddress,
    normalizeTonAddress(platform.toRawString(), "testnet")
  );
  assert.equal(
    result.arbitratorWalletAddress,
    normalizeTonAddress(arbitrator.toRawString(), "testnet")
  );
  assert.equal(Address.isFriendly(result.platformWalletAddress), true);
  assert.equal(result.arbitratorTelegramId, "123456789");
});

test("uses a generic public message for malformed or conflicting roles", () => {
  assert.equal(
    paymentReadinessMessage(
      ["platform_wallet_invalid", "wallet_roles_not_distinct"],
      "testnet"
    ),
    "Payments are paused because the testnet fee and arbitration configuration needs review."
  );
});
