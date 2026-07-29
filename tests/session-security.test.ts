import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  expiredSessionCookies,
  hashSessionToken,
  sessionCookie,
  sessionRequestHasSafeOrigin,
  sessionTokenFromRequest,
} from "../lib/session-security.ts";

test("creates opaque session tokens and stores only a deterministic hash", async () => {
  const token = createSessionToken();
  const secondToken = createSessionToken();

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(token, secondToken);
  assert.match(await hashSessionToken(token), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await hashSessionToken(token), await hashSessionToken(token));
  assert.notEqual(await hashSessionToken(token), token);
});

test("uses a host-only secure cookie in production and a local development cookie", () => {
  const token = "a".repeat(43);
  const production = sessionCookie(
    new Request("https://easywallet.rexai.world/api/wallet/verify"),
    token
  );
  const local = sessionCookie(
    new Request("http://localhost:3001/api/wallet/verify"),
    token
  );

  assert.match(production, /^__Host-easywallet_session=/);
  assert.match(production, /HttpOnly/);
  assert.match(production, /SameSite=Lax/);
  assert.match(production, /Secure/);
  assert.doesNotMatch(production, /Domain=/);

  assert.match(local, /^easywallet_session=/);
  assert.match(local, /HttpOnly/);
  assert.doesNotMatch(local, /Secure/);
});

test("accepts only correctly shaped session tokens from cookies", () => {
  const token = "b".repeat(43);
  const valid = new Request("https://easywallet.rexai.world/api/session", {
    headers: {
      cookie: `ignored=1; __Host-easywallet_session=${token}`,
    },
  });
  const malformed = new Request("https://easywallet.rexai.world/api/session", {
    headers: {
      cookie: "__Host-easywallet_session=not-a-token",
    },
  });

  assert.equal(sessionTokenFromRequest(valid), token);
  assert.equal(sessionTokenFromRequest(malformed), undefined);
});

test("requires an exact same-origin header for state-changing session requests", () => {
  assert.equal(
    sessionRequestHasSafeOrigin(
      new Request("https://easywallet.rexai.world/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://easywallet.rexai.world" },
      })
    ),
    true
  );
  assert.equal(
    sessionRequestHasSafeOrigin(
      new Request("https://easywallet.rexai.world/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://attacker.example" },
      })
    ),
    false
  );
  assert.equal(
    sessionRequestHasSafeOrigin(
      new Request("https://easywallet.rexai.world/api/auth/logout", {
        method: "POST",
      })
    ),
    false
  );
  assert.equal(
    sessionRequestHasSafeOrigin(
      new Request("https://easywallet.rexai.world/api/session")
    ),
    true
  );
});

test("expires both production and local cookie names during sign-out", () => {
  const expired = expiredSessionCookies();

  assert.equal(expired.length, 2);
  assert.ok(expired.some((cookie) => cookie.startsWith("__Host-")));
  assert.ok(expired.every((cookie) => cookie.includes("Max-Age=0")));
});
