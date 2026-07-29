"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";

export function EzWalletProviders({
  manifestUrl,
  twaReturnUrl,
  children,
}: {
  manifestUrl: string;
  twaReturnUrl?: string;
  children: React.ReactNode;
}) {
  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={
        twaReturnUrl ? { twaReturnUrl } : undefined
      }
    >
      {children}
    </TonConnectUIProvider>
  );
}
