# Easy Wallet architecture

## Runtime

- Telegram Mini App frontend: React, TypeScript, and a responsive app shell.
- Edge API and Telegram webhook: Cloudflare Worker.
- Relational data: Cloudflare D1 with tracked SQL migrations.
- Listing media: Cloudflare R2 with size/type validation and unguessable object keys.
- Wallet integration: TON Connect in the browser plus server-side TON proof verification.
- Escrow: one deterministic native-TON contract per deal, compiled from
  Acton/Tolk and deployed atomically with buyer funding.
- Payment monitoring: a scheduled Worker queries TON Center and confirms the
  pinned contract code, state, action messages, payouts, and destruction.

The frontend and API share one origin. This keeps cookies, CSRF/origin checks, the TON manifest, and Telegram launch configuration simple.

## Trust boundaries

```text
Telegram client
  └─ signed initData ──> Worker authentication

User wallet
  ├─ TON Connect session ──> browser
  ├─ ton_proof ──> Worker verification
  └─ signed escrow transaction BoC ──> TON network

Deal escrow
  ├─ immutable participants, amounts, deadlines, and fees
  ├─ delivery/dispute/release/refund messages
  └─ fixed terminal payouts ──> buyer, seller, and platform

Worker
  ├─ prepared statements ──> D1
  ├─ validated media ──> R2
  ├─ Bot API calls ──> Telegram
  └─ payment observation ──> TON provider
```

Untrusted inputs include Telegram request bodies, Mini App init data before validation, wallet responses, uploaded files, all form data, URL parameters, Telegram bot updates, and TON provider responses.

## Authentication

1. The frontend posts raw `Telegram.WebApp.initData`.
2. The Worker verifies the official HMAC data-check string and a short `auth_date` window.
3. The Worker upserts the Telegram profile.
4. A cryptographically random opaque session token is returned as a secure, HTTP-only, same-origin cookie.
5. D1 stores only a SHA-256 hash of the session token.
6. Mutating requests require the session, the expected request origin, and a per-session CSRF value.

Local demo authentication is restricted to loopback/preview hosts and cannot be enabled by a public request header in production.

## Wallet binding

1. The backend issues a random, single-use TON proof nonce tied to the authenticated session.
2. TON Connect asks the wallet to sign the proof for the current app domain.
3. The Worker checks the nonce, timestamp, exact domain, address/state-init relationship, and Ed25519 signature.
4. The nonce is consumed and the verified address/network is stored.

Wallet responses are never treated as identity proof without this verification.

## Payments

Easy Wallet is non-custodial. A deal quote is created by the Worker using
integer nanotons and immutable recipients:

- buyer total: base price plus the buyer's 1% fee;
- seller proceeds: base price minus the seller's 1% fee;
- platform proceeds: the combined buyer and seller fees;
- a refundable deployment/action reserve covers contract gas and storage.

The Worker derives the contract data, `StateInit`, address, and funding body from
the frozen quote. The client submits that one-message request to TON Connect.
The returned BoC means the wallet signed/broadcast a message; it does not prove
funding. The backend independently verifies the deployed code and data hashes,
source, exact value, and body before advancing the deal. The same rule applies
to delivery, dispute, release, and refund actions. Terminal settlement is only
accepted when fixed payouts and contract destruction are observed.

Funding and action reconciliation also scans server-prepared records, so a lost
browser callback does not strand a successful transaction. Stale records expire
only after their wallet validity window, a safety delay, and a successful
provider query that finds no matching finalized message.

## Data integrity

- IDs use `crypto.randomUUID()`.
- Currency amounts are stored as decimal text and handled as `bigint` in code.
- SQL values use prepared statements.
- Unique and partial indexes prevent duplicate active deals, duplicate applications, duplicate reviews, replayed payment references, and replayed proof nonces.
- Deal events and ledger entries are append-only.
- Prepared and submitted chain actions are durable and idempotently reconciled.
- Listing edits never rewrite a previously accepted quote.
- Public listing coordinates are stored as rounded integer microdegrees with a
  minimum uncertainty radius; exact device coordinates are discarded.
- State transitions are checked on the server.

## Deployment secrets

Required Worker secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `RECONCILE_SECRET`
- `TONCENTER_API_KEY` when provider rate limits require one

Required non-secret configuration:

- production app origin
- platform TON address
- arbitrator TON address and authorized Telegram operator ID
- TON network (`mainnet` for launch; testnet during verification)
- Telegram bot username
- init-data and proof freshness windows

No seed phrase, private key, or custodial signing key belongs in this project.
