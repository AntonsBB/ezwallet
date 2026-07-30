import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { PwaRegistration } from "./PwaRegistration";

export const metadata: Metadata = {
  title: "Easy Wallet — A wallet-first Web3 marketplace",
  description:
    "Buy, sell and find local work from the browser with a wallet you control.",
  applicationName: "Easy Wallet",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/icon-180.png",
    apple: "/brand/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "Easy Wallet",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    title: "Easy Wallet — Buy. Sell. Work.",
    description:
      "A wallet-first marketplace for goods, services and local work.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Easy Wallet" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Easy Wallet — Buy. Sell. Work.",
    description:
      "A wallet-first marketplace for goods, services and local work.",
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
      <body suppressHydrationWarning>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
