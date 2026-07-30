import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const publicPreviewHost = process.env.EZWALLET_PREVIEW_HOST?.trim();
const isCloudflareProduction =
  process.env.CLOUDFLARE_ENV?.trim() === "production";
const localVariableNames = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_USERNAME",
  "TELEGRAM_WEBHOOK_SECRET",
  "MINI_APP_URL",
  "PLATFORM_FEE_ADDRESS",
  "ESCROW_ARBITRATOR_ADDRESS",
  "TON_NETWORK",
  "TONCENTER_API_KEY",
  "RECONCILE_SECRET",
  "DEAL_DATA_ENCRYPTION_KEY",
  "ENVIRONMENT",
] as const;
const localVars = Object.fromEntries(
  localVariableNames.flatMap((name) => {
    const value = process.env[name]?.trim();
    return value ? [[name, value]] : [];
  })
);

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server:
      isCodexSeatbeltSandbox || publicPreviewHost
        ? {
            ...(isCodexSeatbeltSandbox
              ? { watch: { useFsEvents: false, usePolling: true } }
              : {}),
            ...(publicPreviewHost
              ? { allowedHosts: [publicPreviewHost] }
              : {}),
          }
        : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        configPath: "./wrangler.jsonc",
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        ...(!isCloudflareProduction && Object.keys(localVars).length
          ? {
              config: (config) => ({
                vars: { ...config.vars, ...localVars },
              }),
            }
          : {}),
      }),
    ],
  };
});
