# Easy Wallet

Easy Wallet is a production-oriented, wallet-first Web3 marketplace for buying
and selling physical or digital goods, offering services, posting jobs, and
hiring people. It runs as an installable web app at
`https://easywallet.rexai.world`; Telegram is an optional launch and contact
adapter and never acts as the account system.

It is intentionally non-custodial:

- A server-issued `ton_proof` establishes wallet ownership and the primary
  marketplace account.
- Browser sessions use random opaque credentials; D1 stores only their hashes.
- Telegram may open the same PWA, but every account and protected action still
  requires wallet proof and the HttpOnly wallet session.
- Private keys and seed phrases never enter Easy Wallet.
- Every paid deal discloses an immutable 1% buyer fee and 1% seller fee only at
  checkout.
- Each deal deploys and funds its own deterministic native-TON escrow contract
  in one wallet transaction.
- A wallet broadcast is only `payment_submitted`; an independent reconciler
  verifies the escrow code, state, sender, exact amount, and message before the
  deal advances.
- D1 stores marketplace state, per-user saved listings, and an append-only
  deal/ledger event history.
- Workers KV stores immutable user-uploaded listing images behind a constrained
  media route.

The product and trust-boundary specifications live in
[`docs/PRODUCT.md`](docs/PRODUCT.md) and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The ordered launch gates and
remaining work are tracked in [`docs/ROADMAP.md`](docs/ROADMAP.md). The exact
external payment gates are documented in
[`docs/TESTNET-DRILL.md`](docs/TESTNET-DRILL.md) and
[`docs/CONTRACT-REVIEW-HANDOFF.md`](docs/CONTRACT-REVIEW-HANDOFF.md). Identity,
KYC, AML, and licensing gates are documented in
[`docs/COMPLIANCE-READINESS.md`](docs/COMPLIANCE-READINESS.md).

## Product surface

- **Market:** physical and digital listings, normalized categories, exact TON
  price ranges, type and price sorting, authenticated saved listings,
  owner-only conflict-safe editing and lifecycle controls, listing creation,
  truthful wallet and reputation signals, direct purchase, and reports.
- **Work:** privacy-safe approximate-area map, opt-in nearby sorting, list
  fallback, authenticated favorites, services, jobs, applications, job-owner
  decisions, and hiring.
- **Wallet:** browser-extension, QR, deep-link, and in-wallet-browser access
  through TON Connect; proof verification, transparent fee breakdown,
  per-deal escrow, delivery/completion/dispute actions, reviews.
- **Profile:** a private owner dashboard and public storefront, owner-only
  on-chain balance snapshot, proof-backed verification levels, review-backed
  reputation without unearned scores, editable details, listing management,
  and safety.
- **Optional bot:** `/start` response with a Web App launch button and
  secret-validated webhook.

Government ID/NFC, custodial balances, fiat exchange, tax-avoidance features,
and civic voting are deliberately outside this release.

## Stack

- React 19, Next 16 App Router, Vinext, TypeScript
- Installable responsive PWA with a deliberately static-only service-worker cache
- Cloudflare Workers and Static Assets
- Cloudflare D1 with Drizzle
- Cloudflare Workers KV
- Optional Telegram Mini Apps and Bot API adapter
- Leaflet with attributed OpenStreetMap tiles
- TON Connect UI, TON proof, TON Center v2/v3
- Acton/Tolk native-TON escrow contract

Node.js `>=22.13.0` is required.

## Local development

```bash
npm ci
copy .env.example .env.local
npm run db:migrate:local
npm run dev
```

Open the printed local URL to review the public product surface. Authenticated
actions require genuine wallet proof; there is no demo identity or seeded
marketplace data.

Useful commands:

```bash
npm run test:unit
npm run lint
npm run build
npm run cloudflare:check
npm test
```

## Cloudflare deployment

`wrangler.jsonc` defines the testnet production Worker, the
`easywallet.rexai.world` custom domain, the `easy-wallet-production` D1
database, the `production-easy-wallet-media` KV namespace, and the two-minute
reconciler. Build and validate the exact deploy artifact with:

```bash
npm run cloudflare:check
```

After Cloudflare authentication, create the KV namespace, apply the checked-in
D1 migrations, configure the secret bindings, and deploy:

```bash
npx wrangler kv namespace create easy-wallet-media --binding MEDIA --env production
npm run db:migrate:production
npm run deploy:production
```

The Worker custom-domain deployment creates and manages the
`easywallet.rexai.world` DNS record and certificate. Confirm that the hostname
is unused before deploying so an unrelated record is never overwritten.

Set these runtime bindings before enabling payments:

| Binding | Required | Purpose |
| --- | --- | --- |
| `ENVIRONMENT=production` | yes | identifies the production runtime in logs and guards |
| `TON_NETWORK=testnet` | yes at first | use `mainnet` only after testnet sign-off |
| `PLATFORM_FEE_ADDRESS` | yes | receives the exact 1% fee from each party after settlement |
| `ESCROW_ARBITRATOR_ADDRESS` | yes | wallet allowed to resolve a disputed on-chain escrow |
| `MINI_APP_URL` | yes | canonical HTTPS deployment URL |
| `TELEGRAM_BOT_TOKEN` | optional, secret | validates optional Mini App sessions and runs the bot |
| `TELEGRAM_BOT_USERNAME` | optional | identifies the optional launch bot |
| `TELEGRAM_WEBHOOK_SECRET` | optional, secret | authenticates optional Telegram webhook requests |
| `RECONCILE_SECRET` | yes, secret | protects manual reconciliation fallback |
| `TONCENTER_API_KEY` | recommended, secret | raises TON Center limits |
| `NEXT_PUBLIC_MAP_TILE_URL` | optional | changes the attributed interactive map tile provider without a code edit |

Do not enable mainnet until all participants can verify mainnet wallets, the fee
and arbitrator addresses are reviewed out-of-band, the escrow contract has an
independent security review, the reconciler has passed testnet failure/replay
tests, and operational moderation is staffed.

`paymentsReady` is fail-closed: the platform and arbitrator wallets must both
be present, valid, and distinct. Arbitration requests are available only to a
proof-verified wallet matching the arbitrator frozen into that deal. The public
bootstrap API returns only safe blocker codes, never configured addresses.

## Optional Telegram adapter

1. Create or choose a bot in BotFather.
2. Configure the deployed HTTPS URL as the bot menu Web App.
3. Set the webhook to
   `https://YOUR_DOMAIN/api/telegram/webhook` with the same secret stored in
   `TELEGRAM_WEBHOOK_SECRET`.
4. Run the helper without writing credentials to disk:

```bash
set TELEGRAM_BOT_TOKEN=...
set TELEGRAM_WEBHOOK_SECRET=...
set MINI_APP_URL=https://YOUR_DOMAIN
npm run telegram:configure
```

The helper never prints the bot token or webhook secret. The main web app,
wallet sign-in, marketplace profiles, and saved activity do not depend on this
adapter.

## Payment state machine

`awaiting_funding -> funded -> delivered -> released`

- `awaiting_funding`: server froze buyer, seller, arbitrator, platform,
  deadlines, price, network, and both exact 1% fees.
- Funding: the buyer deploys and funds the deterministic escrow atomically.
- `funded`: the reconciler independently matched the escrow code, state,
  sender, exact value, and funding payload.
- `delivered`: the seller submitted immutable delivery evidence on-chain.
- `released`: the buyer confirmed, or the review timeout elapsed, and the
  contract paid fixed seller proceeds plus the two platform fees.
- `disputed`: the funds remain in the contract until the configured arbitrator
  signs release or refund.
- `refunded`: an eligible expiry or arbitrator decision returned the remaining
  contract balance to the buyer.
- An unfunded request closes automatically only after its wallet window has
  elapsed and the reconciler finds no matching finalized funding transaction.

The contract sources, generated TypeScript wrapper, test scenarios, and threat
assumptions are documented in [`chain/README.md`](chain/README.md).

## Security

Read [`SECURITY.md`](SECURITY.md) before testing. Report exploitable issues
through GitHub private vulnerability reporting, never a public issue.

Released under the [MIT License](LICENSE).
