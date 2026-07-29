import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTransactionFees,
  marketplaceAmountToNano,
  nanoToTon,
  tonToNano,
} from "../lib/format.ts";

test("parses TON amounts without floating-point math", () => {
  assert.equal(tonToNano("1"), "1000000000");
  assert.equal(tonToNano("0.000000001"), "1");
  assert.equal(tonToNano("12.345678901"), "12345678901");
  assert.throws(() => tonToNano("1e9"));
  assert.throws(() => tonToNano("-1"));
  assert.throws(() => tonToNano("1.0000000001"));
});

test("enforces the marketplace minimum before fee construction", () => {
  assert.equal(marketplaceAmountToNano("0.001"), "1000000");
  assert.throws(() => marketplaceAmountToNano("0.000999999"));
  assert.throws(() => marketplaceAmountToNano("not-a-number"));
});

test("charges each transaction party 1% with exact integer accounting", () => {
  for (const amount of [100n, 101n, 1_000_000_000n]) {
    const split = calculateTransactionFees(amount);
    const expectedPartyFee = (amount + 99n) / 100n;
    assert.equal(split.buyerFeeNano, expectedPartyFee);
    assert.equal(split.sellerFeeNano, expectedPartyFee);
    assert.equal(split.buyerTotalNano, amount + expectedPartyFee);
    assert.equal(split.sellerAmountNano, amount - expectedPartyFee);
    assert.equal(split.platformFeeNano, expectedPartyFee * 2n);
    assert.equal(
      split.sellerAmountNano + split.platformFeeNano,
      split.buyerTotalNano
    );
  }
  assert.throws(() => calculateTransactionFees(0n));
  assert.throws(() => calculateTransactionFees(1n));
});

test("formats nanos for wallet UI", () => {
  assert.equal(nanoToTon("3400000000"), "3.4");
  assert.equal(nanoToTon("1000000", 4), "0.001");
});
