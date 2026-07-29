# Easy Wallet

Easy Wallet is a production-oriented Telegram Mini App for buying and selling
physical or digital goods, offering services, posting jobs, hiring people, and
paying directly with TON.

It is intentionally non-custodial:

- Telegram Mini App launch data is verified on the server.
- Wallet ownership is bound to the Telegram profile with `ton_proof`.
- Private keys and seed phrases never enter Easy Wallet.
- Every paid deal discloses an immutable 1% buyer fee and 1% seller fee only at
  checkout.
- A wallet broadcast is only `payment_submitted`; an independent reconciler
  verifies both expected finalized recipient transfers before the deal advances.
- D1 stores marketplace state and an append-only deal/ledger event history.
- R2 stores user-uploaded listing images behind a constrained media route.

The product and trust-boundary specifications live in
[`docs/PRODUCT.md`](docs/PRODUCT.md) and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Product surface

- **Market:** physical and digital listings, search, category filtering,
  listing creation, direct purchase, reports.
- **Work:** services, jobs, applications, job-owner decisions, and hiring.
- **Wallet:** TON Connect, proof verification, transparent fee breakdown,
  on-chain confirmation, delivery/completion/dispute actions, reviews.
- **Profile:** Telegram identity, public reputation, editable details, listings,
  wallet status, and safety resources.
- **Bot:** `/start` response with a Web App launch button and secret-validated
  webhook.

Government ID/NFC, custodial balances, fiat exchange, tax-avoidance features,
and civic voting are deliberately outside this release.

## Stack

- React 19, Next 16 App Router, Vinext, TypeScript
- Cloudflare Workers and Static Assets
- Cloudflare D1 with Drizzle
- Cloudflare R2
- Telegram Mini Apps and Bot API
- TON Connect UI, TON proof, TON Center v2/v3

Node.js `>=22.13.0` is required.

## Local development

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Open the printed local URL. Localhost permits a demo Telegram profile so the UI
can be reviewed without weakening deployed authentication. Wallet verification
still requires a real activated TON testnet wallet.

For a temporary HTTPS tunnel, set `EZWALLET_PREVIEW_HOST` to the tunnel's exact
hostname (for example, `example.ngrok-free.app`). The development server only
accepts that configured host; do not use a wildcard. Set the Telegram runtime
variables in the same process that starts `npm run dev`.

Useful commands:

```bash
npm run test:unit
npm run lint
npm run build
npm test
```

## Cloudflare deployment

`.openai/hosting.json` declares D1 as `DB` and R2 as `MEDIA`. Apply the checked-in
SQL migrations in `drizzle/` to the production D1 database, configure a two-minute
scheduled trigger for the Worker, then set:

| Binding | Required | Purpose |
| --- | --- | --- |
| `ENVIRONMENT=production` | yes | disables demo seeding |
| `TON_NETWORK=testnet` | yes at first | use `mainnet` only after testnet sign-off |
| `PLATFORM_FEE_ADDRESS` | yes | receives the disclosed 1% fee from each transaction party |
| `MINI_APP_URL` | yes | canonical HTTPS deployment URL |
| `TELEGRAM_BOT_TOKEN` | yes, secret | validates Mini App sessions and runs the bot |
| `TELEGRAM_BOT_USERNAME` | yes | builds the wallet return link to the dedicated bot |
| `TELEGRAM_WEBHOOK_SECRET` | yes, secret | authenticates Telegram webhook requests |
| `RECONCILE_SECRET` | yes, secret | protects manual reconciliation fallback |
| `TONCENTER_API_KEY` | recommended, secret | raises TON Center limits |

Do not enable mainnet until all participants can verify mainnet wallets, the fee
address is reviewed out-of-band, the payment reconciler has passed testnet
failure/replay tests, and operational moderation is staffed.

## Telegram setup

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

The helper never prints the bot token or webhook secret.

## Payment state machine

`pending_wallet → payment_submitted → awaiting_delivery → fulfilled`

- `pending_wallet`: server froze recipients, amount, network, and both 1% fees.
- `payment_submitted`: wallet returned a BOC; no payment claim is made.
- `awaiting_delivery`: the reconciler independently matched both exact
  recipient transfers, amounts, sender, comments, and indexed transaction
  hashes.
- `fulfilled`: the buyer confirmed receipt.
- `cancelled` is only valid before wallet submission.
- `disputed` preserves the record for moderation; it cannot reverse TON.

## Security

Read [`SECURITY.md`](SECURITY.md) before testing. Report exploitable issues
through GitHub private vulnerability reporting, never a public issue.

Released under the [MIT License](LICENSE).
