import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIdentityClaimUrl,
  createIdentityLinkToken,
  hashIdentityLinkToken,
  IDENTITY_LINK_TOKEN_PATTERN,
} from "../lib/identity-link";

test("creates opaque one-time profile-claim tokens and stores only their hash", async () => {
  const token = createIdentityLinkToken();
  const secondToken = createIdentityLinkToken();
  assert.match(token, IDENTITY_LINK_TOKEN_PATTERN);
  assert.match(secondToken, IDENTITY_LINK_TOKEN_PATTERN);
  assert.notEqual(token, secondToken);

  const digest = await hashIdentityLinkToken(token);
  assert.match(digest, IDENTITY_LINK_TOKEN_PATTERN);
  assert.notEqual(digest, token);
  assert.equal(await hashIdentityLinkToken(token), digest);
});

test("builds a scoped HTTPS claim link without dropping existing parameters", () => {
  const token = createIdentityLinkToken();
  const claimUrl = new URL(
    buildIdentityClaimUrl("https://easywallet.rexai.world/?source=bot", token)
  );
  assert.equal(claimUrl.origin, "https://easywallet.rexai.world");
  assert.equal(claimUrl.searchParams.get("source"), "bot");
  assert.equal(claimUrl.searchParams.get("claim"), token);
});

test("rejects malformed claim tokens before hashing or URL construction", async () => {
  await assert.rejects(
    () => hashIdentityLinkToken("short"),
    /malformed/
  );
  assert.throws(
    () => buildIdentityClaimUrl("https://easywallet.rexai.world", "short"),
    /malformed/
  );
});
