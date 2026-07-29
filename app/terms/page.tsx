import Link from "next/link";

export const metadata = { title: "Terms of Use · EzWallet" };

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-back">Back to EzWallet</Link>
      <p className="eyebrow">Terms of use</p>
      <h1>Clear rules for direct trade.</h1>
      <p className="legal-updated">Effective 29 July 2026</p>
      <section>
        <h2>What EzWallet provides</h2>
        <p>
          EzWallet is a Telegram marketplace that helps people publish
          listings, apply for work, create deal records, and prepare
          non-custodial TON transfers. EzWallet is not a bank, exchange,
          escrow service, employer, tax adviser, or wallet custodian.
        </p>
      </section>
      <section>
        <h2>Your wallet and payments</h2>
        <p>
          You control your wallet and approve every transfer in your wallet
          application. Never share a seed phrase or private key. Each paid deal
          discloses a fixed 1% platform fee before approval. Blockchain
          transfers are generally irreversible; verify the recipient, amount,
          network, listing, and delivery terms before signing.
        </p>
      </section>
      <section>
        <h2>Listings and conduct</h2>
        <p>
          You must provide truthful information and may only offer lawful goods,
          services, and work. Prohibited content includes stolen or counterfeit
          goods, weapons, illegal drugs, exploitation, harassment, deceptive
          financial schemes, credential trading, and instructions intended to
          evade taxes or regulation.
        </p>
      </section>
      <section>
        <h2>Disputes and enforcement</h2>
        <p>
          Users remain responsible for the underlying agreement. EzWallet may
          preserve deal evidence, restrict accounts, remove listings, and
          cooperate with lawful requests. A report or dispute does not reverse
          an on-chain transfer.
        </p>
      </section>
      <section>
        <h2>Availability and liability</h2>
        <p>
          The service is provided without a guarantee of uninterrupted
          availability. To the extent permitted by law, EzWallet is not liable
          for wallet compromise, user misrepresentation, price volatility,
          failed delivery, or irreversible third-party blockchain actions.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Security issues should follow the private reporting process in the
          public repository. Other support requests can be sent through the
          EzWallet bot.
        </p>
      </section>
    </main>
  );
}
