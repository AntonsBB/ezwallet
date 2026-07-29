import { headers } from "next/headers";
import { canonicalAppOrigin, telegramBotUrl } from "@/lib/app-url";
import { EzWalletProviders } from "./providers";
import EzWalletApp from "./EzWalletApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  const fallbackOrigin = host
    ? `${protocol}://${host}`
    : "https://easywallet.abbrains.xyz";
  const origin = canonicalAppOrigin(fallbackOrigin);

  return (
    <EzWalletProviders
      manifestUrl={`${origin}/tonconnect-manifest.json`}
      twaReturnUrl={telegramBotUrl()}
    >
      <EzWalletApp />
    </EzWalletProviders>
  );
}
