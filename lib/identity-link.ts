const IDENTITY_LINK_TOKEN_BYTES = 32;

export const IDENTITY_LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createIdentityLinkToken() {
  return toBase64Url(
    crypto.getRandomValues(new Uint8Array(IDENTITY_LINK_TOKEN_BYTES))
  );
}

export async function hashIdentityLinkToken(token: string) {
  if (!IDENTITY_LINK_TOKEN_PATTERN.test(token)) {
    throw new Error("Identity-link token is malformed.");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return toBase64Url(new Uint8Array(digest));
}

export function buildIdentityClaimUrl(appUrl: string, token: string) {
  if (!IDENTITY_LINK_TOKEN_PATTERN.test(token)) {
    throw new Error("Identity-link token is malformed.");
  }
  const url = new URL(appUrl);
  url.searchParams.set("claim", token);
  return url.toString();
}
