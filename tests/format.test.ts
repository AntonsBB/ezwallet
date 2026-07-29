import assert from "node:assert/strict";
import test from "node:test";
import {
  nanoToTon,
  splitPlatformFee,
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

test("splits every paid deal into immutable 99% and 1% amounts", () => {
  for (const amount of [1n, 99n, 100n, 101n, 1_000_000_000n]) {
    const split = splitPlatformFee(amount);
    assert.equal(split.platformFeeNano + split.sellerAmountNano, amount);
    assert.ok(split.platformFeeNano >= 1n);
    assert.equal(split.platformFeeNano, (amount + 99n) / 100n);
  }
});

test("formats nanos for wallet UI", () => {
  assert.equal(nanoToTon("3400000000"), "3.4");
  assert.equal(nanoToTon("1000000", 4), "0.001");
});
