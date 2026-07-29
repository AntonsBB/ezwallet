/** Cloudflare Worker entry point for Easy Wallet. */
import handler from "vinext/server/app-router-entry";
import { reconcilePendingDeals } from "../lib/ton-payment";

type EasyWalletEnv = Env & {
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
};

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
    "strict-transport-security",
    "max-age=31536000; includeSubDomains"
  );
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
  async fetch(
    request: Request,
    env: EasyWalletEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    return withSecurityHeaders(await handler.fetch(request, env, ctx));
  },
  async scheduled(
    _controller: ScheduledController,
    _env: EasyWalletEnv,
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

export default worker satisfies ExportedHandler<EasyWalletEnv>;
