# Easy Wallet architecture

## Runtime

- Installable Web3 PWA: React, TypeScript, a responsive app shell, and a
  static-assets-only service-worker cache.
- Edge API and optional Telegram webhook: Cloudflare Worker.
- Relational data: Cloudflare D1 with tracked SQL migrations.
- Listing media: Cloudflare Workers KV with size/type validation, immutable
  values, and unguessable object keys.
- Local discovery: client-side Leaflet map with attributed OpenStreetMap tiles,
  rounded listing areas, and a complete list fallback.
- Wallet integration: TON Connect across browser extensions, QR/universal
  links, mobile wallet browsers, and the optional Telegram environment, plus
  server-side TON proof verification.
- Escrow: one deterministic native-TON contract per deal, compiled from
  Acton/Tolk and deployed atomically with buyer funding.
- Payment monitoring: a scheduled Worker queries TON Center and confirms the
  pinned contract code, state, action messages, payouts, and destruction.

The frontend and API share one origin. This keeps host-only cookies,
CSRF/origin checks, and the TON manifest simple.

## Trust boundaries

```text
User wallet
  |-- TON Connect session --> browser
  |-- single-use ton_proof --> Worker authentication
  `-- signed escrow transaction BoC --> TON network

Optional Telegram client
  `-- launch link --> the same wallet-authenticated PWA

Deal escrow
  |-- immutable participants, amounts, deadlines, and fees
  |-- delivery/dispute/release/refund messages
  `-- fixed terminal payouts --> buyer, seller, and platform

Worker
  |-- prepared statements --> D1
  |-- validated media --> Workers KV
  |-- optional Bot API calls --> Telegram
  `-- payment observation --> TON provider
```

Untrusted inputs include wallet responses, cookies, uploaded files, all form
data, URL parameters, Telegram request bodies and init data before validation,
bot updates, and TON provider responses.

## Authentication

1. The backend creates a cryptographically random, short-lived, single-use TON
   proof challenge. It may be anonymous or bound to an existing account.
2. The wallet signs the challenge for the exact Easy Wallet domain.
3. The Worker verifies the nonce, timestamp, domain, network,
   address/state-init relationship, public key, and Ed25519 signature.
4. The proof is claimed with a compare-and-set update so a replay cannot create
   a second session.
5. The verified wallet resolves to one unique profile, or creates a new
   wallet-only profile.
6. The browser receives a seven-day `HttpOnly`, `SameSite=Lax`,
   production `__Host-` session cookie. D1 stores only its SHA-256 hash.
7. State-changing cookie-authenticated requests require the exact application
   origin. Sign-out revokes the server row and expires both cookie variants.

Telegram is a launch adapter only. It does not create an application session or
authorize API actions. The Telegram script is loaded only for actual Telegram
launch URLs so native presentation and haptics remain available; the user must
still prove wallet control to create or enter an account.

There is no localhost bypass, demo user, password, plaintext bearer-token
storage, or seeded production identity.

`account_identities` is the chain-neutral ownership registry. Its unique
provider/namespace/subject key prevents one wallet identity from being attached
to two profiles, while a second unique key prevents silent same-chain identity
replacement on an existing profile. The legacy wallet columns remain the
current TON settlement pointer until another independently reviewed rail
exists.

Existing Telegram-era profiles can be claimed only from the same Telegram user
in a private chat. `/claim` creates a random ten-minute token, stores only its
SHA-256 hash, invalidates older tickets, and sends the raw token only to that
private chat. Opening the link does not authenticate the user: it binds a
single wallet-proof challenge to the legacy profile. The token, challenge, TON
proof, identity uniqueness checks, and final ticket consumption must all pass
before the wallet is attached. Telegram never becomes a reusable application
session.

## Wallet binding

1. The backend issues a random, single-use TON proof nonce, optionally tied to
   an existing authenticated session.
2. TON Connect asks the wallet to sign the proof for the current app domain.
3. The Worker checks the nonce, timestamp, exact domain, address/state-init relationship, and Ed25519 signature.
4. The nonce is atomically consumed and the verified address/network becomes a
   unique account identity and the current TON settlement wallet.

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

The public payment-readiness gate uses the same configuration validator as both
deal-creation paths. It requires valid, distinct platform and arbitrator wallet
roles. Missing, malformed, or reused roles keep checkout disabled and return
only non-sensitive blocker codes. An arbitrator can prepare a resolution only
while authenticated by a proof-verified wallet matching the address frozen
into the disputed deal. Buyer and seller addresses are normalized and all four
escrow roles are checked for uniqueness again while deriving the contract.

Funding and action reconciliation also scans server-prepared records, so a lost
browser callback does not strand a successful transaction. Stale records expire
only after their wallet validity window, a safety delay, and a successful
provider query that finds no matching finalized message.

## Data integrity

- IDs use `crypto.randomUUID()`.
- Currency amounts are stored as decimal text and handled as `bigint` in code.
- SQL values use prepared statements.
- Unique and partial indexes prevent duplicate active deals, duplicate
  applications, duplicate reviews, duplicate per-user saved listings, replayed
  payment references, duplicate wallet identities, and replayed proof nonces.
- Saved listing rows are scoped to the authenticated wallet profile on every
  read and mutation; the browser cannot choose a different profile.
- Listing lifecycle mutations are owner-scoped, follow an explicit transition
  matrix, use a compare-and-set update to reject concurrent changes, and never
  delete the historical row. A paused or closed post disappears from public
  discovery without rewriting an existing deal.
- Deal events and ledger entries are append-only.
- Prepared and submitted chain actions are durable and idempotently reconciled.
- Listing edits are owner-scoped and compare the last-seen `updatedAt` value.
  Section and type are immutable, terminal posts cannot be edited, and any
  active deal or open application blocks the edit. Previously accepted quotes
  are never rewritten.
- Public listing coordinates are stored as rounded integer microdegrees with a
  minimum uncertainty radius; exact device coordinates are discarded.
- Nearby sorting is opt-in. The browser immediately rounds the device result,
  retains only that public-area point in memory, and never sends the device
  position to the API. Map circles communicate listing uncertainty instead of
  implying a precise address.
- Map tiles are best-effort presentation data. Tile or permission failure never
  hides listings or blocks search, filtering, opening a post, or publishing
  without an area.
- State transitions are checked on the server.

## Deployment secrets

Required Worker secrets:

- `RECONCILE_SECRET`
- `TONCENTER_API_KEY` when provider rate limits require one

Optional adapter secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

Required non-secret configuration:

- production app origin
- platform TON address
- arbitrator TON address controlled by a distinct, independently reviewed party
- TON network (`mainnet` for launch; testnet during verification)
- optional Telegram bot username
- proof and optional init-data freshness windows

No seed phrase, private key, or custodial signing key belongs in this project.

## Chain adapter boundary

Marketplace profiles and browser sessions are intentionally separate from
settlement. TON is the first implemented identity and escrow adapter, not a
claim of universal chain support. A future EVM, Solana, Bitcoin, XRP, token, or
stablecoin adapter must provide chain-specific ownership proof, canonical
account identifiers, transaction construction, finalized-state reconciliation,
fee accounting, dispute semantics, adversarial tests, and an independent
security review. A wallet logo or WalletConnect session alone is not a payment
rail.

Future recipient addresses are stored separately from enabled payment
configuration. A row marked `unverified` or `disabled` is inventory only. It
cannot make checkout ready and must not receive funds until the address,
network, asset contract where relevant, controller, contract adapter, provider
confirmation rules, and independent test evidence are verified.

## Fulfillment boundary

`listings.fulfillment_mode` separates shipping, pickup, digital, and service
flows. `deal_fulfillments` stores participant-only state. A shipping address is
validated in the authenticated checkout request, encrypted with AES-256-GCM
using the deal ID as authenticated context, and written only as ciphertext.
It is never copied into listing, event, bootstrap, storefront, or log data.

The buyer can read their own submitted address. The seller receives it only
after the reconciler has verified escrow funding. Carrier and tracking details
are participant-only, and a shipping deal cannot prepare the delivered
on-chain action until tracking has been recorded.
