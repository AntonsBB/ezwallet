const PRODUCTION_SESSION_COOKIE = "__Host-easywallet_session";
const LOCAL_SESSION_COOKIE = "easywallet_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createSessionToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return toBase64Url(new Uint8Array(digest));
}

function parseCookies(value: string) {
  return new Map(
    value
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator === -1
          ? [part, ""]
          : [part.slice(0, separator), part.slice(separator + 1)];
      })
  );
}

export function sessionTokenFromRequest(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  const token =
    cookies.get(PRODUCTION_SESSION_COOKIE) ??
    cookies.get(LOCAL_SESSION_COOKIE);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

export function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:";
  const name = secure ? PRODUCTION_SESSION_COOKIE : LOCAL_SESSION_COOKIE;
  return [
    `${name}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function expiredSessionCookies() {
  return [
    `${PRODUCTION_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`,
    `${LOCAL_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
}

export function sessionRequestHasSafeOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    return true;
  }
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function anonymousRequestKey(request: Request) {
  const address = request.headers.get("cf-connecting-ip") ?? "unavailable";
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 256);
  return hashSessionToken(`${address}\0${userAgent}`);
}
