/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { reconcilePendingDeals } from "../lib/ton-payment";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA?: R2Bucket;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  MINI_APP_URL?: string;
  PLATFORM_FEE_ADDRESS?: string;
  ESCROW_ARBITRATOR_ADDRESS?: string;
  ESCROW_ARBITRATOR_TELEGRAM_ID?: string;
  TON_NETWORK?: string;
  TONCENTER_API_KEY?: string;
  RECONCILE_SECRET?: string;
  ENVIRONMENT?: string;
  SEED_DEMO_DATA?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function withSecurityHeaders(response: Response) {
  const secured = new Response(response.body, response);
  secured.headers.set("x-content-type-options", "nosniff");
  secured.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  secured.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(self), payment=()"
  );
  secured.headers.set("cross-origin-opener-policy", "same-origin-allow-popups");
  secured.headers.set(
    "content-security-policy",
    [
      "default-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://telegram.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.ton.org https://*.tonapi.io https://*.toncenter.com https://connect.tonhubapi.com https://bridge.tonapi.io wss:",
    ].join("; ")
  );
  if (secured.headers.get("content-type")?.includes("text/html")) {
    secured.headers.set("cache-control", "no-store");
  }
  return secured;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return withSecurityHeaders(await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths));
    }

    return withSecurityHeaders(await handler.fetch(request, env, ctx));
  },
  async scheduled(
    _controller: ScheduledController,
    _env: Env,
    ctx: ExecutionContext
  ) {
    ctx.waitUntil(
      reconcilePendingDeals().catch((error) => {
        console.error(
          JSON.stringify({
            message: "payment_reconciliation_failed",
            error: error instanceof Error ? error.message : String(error),
          })
        );
      })
    );
  },
};

export default worker;
