import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Easy Wallet — Buy, sell and work with TON",
  description:
    "A Telegram marketplace for goods, services and work, powered by non-custodial TON payments.",
  applicationName: "Easy Wallet",
  icons: {
    icon: "/brand/icon-180.png",
    apple: "/brand/icon-180.png",
  },
  openGraph: {
    type: "website",
    title: "Easy Wallet — Buy. Sell. Work.",
    description:
      "A people-powered Telegram marketplace with non-custodial TON payments.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Easy Wallet" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Easy Wallet — Buy. Sell. Work.",
    description:
      "A people-powered Telegram marketplace with non-custodial TON payments.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
