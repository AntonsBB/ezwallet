# Easy Wallet architecture

## Runtime

- Telegram Mini App frontend: React, TypeScript, and a responsive app shell.
- Edge API and Telegram webhook: Cloudflare Worker.
- Relational data: Cloudflare D1 with tracked SQL migrations.
- Listing media: Cloudflare R2 with size/type validation and unguessable object keys.
- Wallet integration: TON Connect in the browser plus server-side TON proof verification.
- Payment monitoring: scheduled Worker queries a TON API/provider and confirms expected finalized transfers.

The frontend and API share one origin. This keeps cookies, CSRF/origin checks, the TON manifest, and Telegram launch configuration simple.

## Trust boundaries

```text
Telegram client
  └─ signed initData ──> Worker authentication

User wallet
  ├─ TON Connect session ──> browser
  ├─ ton_proof ──> Worker verification
  └─ signed transaction BoC ──> TON network

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

Easy Wallet is non-custodial. A deal quote is created by the Worker using integer nanotons and immutable recipients:

- buyer total: base price plus the buyer's 1% fee;
- seller message: base price minus the seller's 1% fee;
- platform message: the combined buyer and seller fees;
- both messages contain deal-specific references.

The client submits the Worker-built request to TON Connect. The returned BoC means the wallet signed/broadcast a message; it does not prove final payment. The backend records it as submitted and independently confirms the finalized transfers before changing the deal to `payment_confirmed`.

## Data integrity

- IDs use `crypto.randomUUID()`.
- Currency amounts are stored as decimal text and handled as `bigint` in code.
- SQL values use prepared statements.
- Unique and partial indexes prevent duplicate active deals, duplicate applications, duplicate reviews, replayed payment references, and replayed proof nonces.
- Deal events and ledger entries are append-only.
- Listing edits never rewrite a previously accepted quote.
- State transitions are checked on the server.

## Deployment secrets

Required Worker secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `SESSION_SECRET` if an additional keyed session derivation is used
- `TON_PROVIDER_API_KEY` when the selected provider requires one

Required non-secret configuration:

- production app origin
- platform TON address
- TON network (`mainnet` for launch; testnet during verification)
- Telegram bot username
- init-data and proof freshness windows

No seed phrase, private key, or custodial signing key belongs in this project.
