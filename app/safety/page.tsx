import Link from "next/link";

export const metadata = { title: "Safety · Easy Wallet" };

export default function SafetyPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-back">Back to Easy Wallet</Link>
      <p className="eyebrow">Safety centre</p>
      <h1>Pause before you approve.</h1>
      <section>
        <h2>Protect your wallet</h2>
        <p>
          Easy Wallet will never ask for a seed phrase or private key. Read every
          TON Connect confirmation, confirm the network, and verify the seller
          payment plus the disclosed 1% fee charged to each party. Disconnect
          unfamiliar sessions from your wallet.
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
        <h2>Payments use per-deal escrow</h2>
        <p>
          The buyer funds a deterministic TON smart contract whose seller,
          buyer, fee recipient, arbitrator, amount, and deadlines are fixed for
          that deal. Easy Wallet independently verifies the deployed code,
          contract state, funding, and final payouts on-chain. Never approve a
          transaction based only on a chat message or screenshot.
        </p>
      </section>
      <section>
        <h2>Report and dispute</h2>
        <p>
          Report suspicious listings from the listing sheet. For a funded deal,
          use “Open dispute” in Wallet activity before settlement; the contract
          then allows only the configured arbitrator to release or refund the
          escrow. In immediate danger, contact local emergency services.
        </p>
      </section>
    </main>
  );
}
