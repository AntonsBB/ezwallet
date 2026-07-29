import { headers } from "next/headers";
import { EzWalletProviders } from "./providers";
import EzWalletApp from "./EzWalletApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "https://ezwallet.online";

  return (
    <EzWalletProviders
      manifestUrl={`${origin}/tonconnect-manifest.json`}
    >
      <EzWalletApp />
    </EzWalletProviders>
  );
}
