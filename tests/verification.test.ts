import assert from "node:assert/strict";
import test from "node:test";
import { verificationSummary } from "../lib/verification.ts";

const now = new Date("2026-07-29T12:00:00.000Z");

test("does not invent an identity badge from wallet proof", () => {
    assert.deepEqual(verificationSummary(true, [], now), {
      level: "wallet",
      label: "Wallet proof",
      assuranceLevel: 0,
      activeKinds: [],
    });
});

test("ignores expired and non-verified checks", () => {
    const summary = verificationSummary(
      true,
      [
        {
          kind: "identity",
          status: "verified",
          assuranceLevel: 2,
          verifiedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-07-28T00:00:00.000Z",
        },
        {
          kind: "address",
          status: "pending",
          assuranceLevel: 2,
          verifiedAt: null,
          expiresAt: null,
        },
      ],
      now
    );

    assert.equal(summary.level, "wallet");
    assert.deepEqual(summary.activeKinds, []);
});

test("requires active identity and address checks for enhanced status", () => {
    const summary = verificationSummary(
      true,
      [
        {
          kind: "identity",
          status: "verified",
          assuranceLevel: 2,
          verifiedAt: "2026-07-01T00:00:00.000Z",
          expiresAt: "2027-07-01T00:00:00.000Z",
        },
        {
          kind: "address",
          status: "verified",
          assuranceLevel: 2,
          verifiedAt: "2026-07-01T00:00:00.000Z",
          expiresAt: "2027-07-01T00:00:00.000Z",
        },
      ],
      now
    );

    assert.equal(summary.level, "enhanced");
    assert.equal(summary.label, "Enhanced verified");
    assert.equal(summary.assuranceLevel, 2);
});
