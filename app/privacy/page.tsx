import Link from "next/link";

export const metadata = { title: "Privacy Policy · Easy Wallet" };

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-back">Back to Easy Wallet</Link>
      <p className="eyebrow">Privacy policy</p>
      <h1>Collect less. Explain the rest.</h1>
      <p className="legal-updated">Effective 29 July 2026</p>
      <section>
        <h2>Data we process</h2>
        <p>
          Telegram supplies your numeric account ID and may supply your name,
          username, language, and profile photo when you open the Mini App. We
          store the profile fields you choose, listings, applications, deal
          events, saved listing references, reviews, reports, wallet public
          addresses, and payment references required to run the marketplace. If
          you explicitly attach a map area, coordinates are rounded before they
          enter application state and are stored with an uncertainty radius; the
          exact device position is discarded.
        </p>
      </section>
      <section>
        <h2>Data we never request</h2>
        <p>
          Easy Wallet never needs or stores wallet seed phrases, private keys, PINs,
          or Telegram passwords. TON proof verifies control of a public wallet
          address without disclosing its private key.
        </p>
      </section>
      <section>
        <h2>Why we use data</h2>
        <p>
          We use data to authenticate sessions, display listings, connect deal
          participants, verify expected on-chain transfers, prevent abuse,
          handle reports, calculate reputation, and meet legal obligations.
        </p>
      </section>
      <section>
        <h2>Service providers and retention</h2>
        <p>
          The application uses Telegram, the TON network and TON data providers,
          Cloudflare infrastructure, OpenStreetMap map tiles, and GitHub for
          source distribution. When you view the map, the tile service receives
          ordinary network request data such as your IP address and this
          application&apos;s origin. We retain marketplace and ledger records
          while needed for safety, disputes, accounting, and legal compliance;
          short-lived wallet challenges expire within minutes.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You may edit profile information, add or remove saved listings,
          pause, reactivate, or close your listings, disconnect your wallet, use
          the Work list without sharing an area, remove an attached approximate
          area before publishing, and ask for deletion where applicable. Some
          deal, moderation, and public blockchain records must be retained or
          cannot be erased.
        </p>
      </section>
    </main>
  );
}
