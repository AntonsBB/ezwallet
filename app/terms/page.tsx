import Link from "next/link";

export const metadata = { title: "Terms of Use · Easy Wallet" };

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-back">Back to Easy Wallet</Link>
      <p className="eyebrow">Terms of use</p>
      <h1>Clear rules for direct trade.</h1>
      <p className="legal-updated">Effective 29 July 2026</p>
      <section>
        <h2>What Easy Wallet provides</h2>
        <p>
          Easy Wallet is a wallet-first Web3 marketplace that helps people
          publish listings, apply for work, create deal records, and prepare
          non-custodial TON smart-contract escrows. Telegram is an optional
          access and contact adapter. Easy Wallet provides escrow software but
          does not custody wallet keys or user funds and is not a bank,
          exchange, employer, or tax adviser.
        </p>
      </section>
      <section>
        <h2>Your wallet and payments</h2>
        <p>
          You control your wallet and approve every transfer in your wallet
          application. Never share a seed phrase or private key. Each paid deal
          discloses the item or service price, a 1% buyer fee, a 1% seller fee,
          the buyer total, and seller proceeds before approval. Blockchain
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
          Users remain responsible for the underlying agreement. Easy Wallet may
          preserve deal evidence, restrict accounts, remove listings, and
          cooperate with lawful requests. Opening a dispute before settlement
          freezes the contract until the configured arbitrator signs a release
          or refund; a completed on-chain settlement is generally irreversible.
        </p>
      </section>
      <section>
        <h2>Availability and liability</h2>
        <p>
          The service is provided without a guarantee of uninterrupted
          availability. To the extent permitted by law, Easy Wallet is not liable
          for wallet compromise, user misrepresentation, price volatility,
          failed delivery, or irreversible third-party blockchain actions.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Security issues should follow the private reporting process in the
          public repository. Other support requests can be sent through the
          Easy Wallet repository or optional bot.
        </p>
      </section>
    </main>
  );
}
