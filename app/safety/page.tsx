import Link from "next/link";

export const metadata = { title: "Safety · EzWallet" };

export default function SafetyPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-back">Back to EzWallet</Link>
      <p className="eyebrow">Safety centre</p>
      <h1>Pause before you approve.</h1>
      <section>
        <h2>Protect your wallet</h2>
        <p>
          EzWallet will never ask for a seed phrase or private key. Read every
          TON Connect confirmation, confirm the network, and verify both the
          seller payment and the disclosed 1% fee. Disconnect unfamiliar
          sessions from your wallet.
        </p>
      </section>
      <section>
        <h2>Trade with evidence</h2>
        <p>
          Keep scope, price, timing, delivery method, and acceptance criteria in
          the listing or application. For physical exchanges, meet in a safe
          public place and inspect the item before confirming receipt.
        </p>
      </section>
      <section>
        <h2>Payments are not escrowed</h2>
        <p>
          Funds go directly from the buyer to the seller and fee wallet.
          EzWallet independently checks the expected finalized transfers but
          cannot reverse them. Do not approve a transfer based only on a chat
          message or screenshot.
        </p>
      </section>
      <section>
        <h2>Report and dispute</h2>
        <p>
          Report suspicious listings from the listing sheet. For a paid deal,
          choose “Report a problem” in Wallet activity so the deal is preserved
          for review. In immediate danger, contact local emergency services.
        </p>
      </section>
    </main>
  );
}
