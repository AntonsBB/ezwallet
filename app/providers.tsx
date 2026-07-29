"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";

export function EzWalletProviders({
  manifestUrl,
  children,
}: {
  manifestUrl: string;
  children: React.ReactNode;
}) {
  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{ twaReturnUrl: "https://t.me/ezwallet" }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
