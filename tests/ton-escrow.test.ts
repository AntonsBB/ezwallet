import assert from "node:assert/strict";
import test from "node:test";
import { Address, Cell, loadStateInit } from "@ton/core";
import {
  buildEscrowActionPayload,
  buildNativeTonEscrow,
  dealIdToUint256,
  ESCROW_FUNDING_RESERVE_NANO,
  queryIdForDeal,
} from "../lib/ton-escrow.ts";

const dealId = "123e4567-e89b-42d3-a456-426614174000";
const addresses = {
  buyer: new Address(0, Buffer.alloc(32, 0x11)).toString(),
  seller: new Address(0, Buffer.alloc(32, 0x22)).toString(),
  arbitrator: new Address(0, Buffer.alloc(32, 0x33)).toString(),
  platform: new Address(0, Buffer.alloc(32, 0x44)).toString(),
};

function build() {
  return buildNativeTonEscrow({
    dealId,
    buyerAddress: addresses.buyer,
    sellerAddress: addresses.seller,
    arbitratorAddress: addresses.arbitrator,
    platformAddress: addresses.platform,
    baseAmountNano: 5_000_000_000n,
    buyerFeeNano: 50_000_000n,
    sellerFeeNano: 50_000_000n,
    buyerTotalNano: 5_050_000_000n,
    sellerAmountNano: 4_950_000_000n,
    platformFeeNano: 100_000_000n,
    deliveryDeadlineUnix: Math.floor(Date.now() / 1000) + 86_400,
    reviewWindowSeconds: 3_600,
    network: "testnet",
  });
}

test("derives deterministic StateInit, address, and exact funding request", () => {
  const first = build();
  const second = build();
  assert.equal(first.address, second.address);
  assert.equal(first.codeHash, second.codeHash);
  assert.equal(first.dataHash, second.dataHash);
  assert.equal(first.fundingPayload, second.fundingPayload);
  assert.equal(
    first.fundingAmountNano,
    5_050_000_000n + ESCROW_FUNDING_RESERVE_NANO
  );

  const stateInit = loadStateInit(Cell.fromBase64(first.stateInit).beginParse());
  assert.ok(stateInit.code);
  assert.ok(stateInit.data);
  assert.equal(stateInit.code.hash().toString("hex"), first.codeHash);
  assert.equal(stateInit.data.hash().toString("hex"), first.dataHash);
});

test("encodes the canonical deal identifier and contract message opcodes", () => {
  assert.equal(
    dealIdToUint256(dealId),
    0x123e4567e89b42d3a456426614174000n
  );
  assert.equal(queryIdForDeal(dealId), 0xa456426614174000n);

  const markDelivered = Cell.fromBase64(
    buildEscrowActionPayload(dealId, "mark_delivered", 0x1234n)
  ).beginParse();
  assert.equal(markDelivered.loadUint(32), 0xd3116e02);
  assert.equal(markDelivered.loadUintBig(64), queryIdForDeal(dealId));
  assert.equal(markDelivered.loadUintBig(256), 0x1234n);

  const confirm = Cell.fromBase64(
    buildEscrowActionPayload(dealId, "confirm_received")
  ).beginParse();
  assert.equal(confirm.loadUint(32), 0xc0f1d003);
});

test("rejects conflicting escrow roles before a wallet is asked to sign", () => {
  assert.throws(
    () =>
      buildNativeTonEscrow({
        dealId,
        buyerAddress: addresses.buyer,
        sellerAddress: addresses.seller,
        arbitratorAddress: addresses.buyer,
        platformAddress: addresses.platform,
        baseAmountNano: 100n,
        buyerFeeNano: 1n,
        sellerFeeNano: 1n,
        buyerTotalNano: 101n,
        sellerAmountNano: 99n,
        platformFeeNano: 2n,
        deliveryDeadlineUnix: Math.floor(Date.now() / 1000) + 86_400,
        network: "testnet",
      }),
    /must differ/
  );
});
