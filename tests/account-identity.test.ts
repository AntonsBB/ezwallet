import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAccountIdentityBinding } from "../lib/account-identity";

test("allows a new proof-backed identity for an unbound target profile", () => {
  assert.deepEqual(
    evaluateAccountIdentityBinding({
      targetUserId: 7,
      subject: "wallet-a",
    }),
    { allowed: true }
  );
});

test("rejects a wallet identity already owned by another profile", () => {
  assert.deepEqual(
    evaluateAccountIdentityBinding({
      targetUserId: 7,
      subject: "wallet-a",
      subjectOwnerUserId: 8,
    }),
    {
      allowed: false,
      reason: "identity_owned_by_another_profile",
    }
  );
});

test("rejects profile substitution and revoked identity reuse", () => {
  assert.deepEqual(
    evaluateAccountIdentityBinding({
      targetUserId: 7,
      subject: "wallet-b",
      profileIdentity: { subject: "wallet-a", revokedAt: null },
    }),
    {
      allowed: false,
      reason: "profile_bound_to_another_identity",
    }
  );
  assert.deepEqual(
    evaluateAccountIdentityBinding({
      targetUserId: 7,
      subject: "wallet-a",
      profileIdentity: {
        subject: "wallet-a",
        revokedAt: "2026-07-30T00:00:00.000Z",
      },
    }),
    {
      allowed: false,
      reason: "profile_identity_revoked",
    }
  );
});

test("allows sign-in to resolve an existing identity without retargeting it", () => {
  assert.deepEqual(
    evaluateAccountIdentityBinding({
      subject: "wallet-a",
      subjectOwnerUserId: 8,
    }),
    { allowed: true }
  );
});
