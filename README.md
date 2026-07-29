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
- Each deal deploys and funds its own deterministic native-TON escrow contract
  in one wallet transaction.
- A wallet broadcast is only `payment_submitted`; an independent reconciler
  verifies the escrow code, state, sender, exact amount, and message before the
  deal advances.
- D1 stores marketplace state and an append-only deal/ledger event history.
- R2 stores user-uploaded listing images behind a constrained media route.

The product and trust-boundary specifications live in
[`docs/PRODUCT.md`](docs/PRODUCT.md) and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The ordered launch gates and
remaining work are tracked in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Product surface

- **Market:** physical and digital listings, search, category filtering,
  listing creation, direct purchase, reports.
- **Work:** services, jobs, applications, job-owner decisions, and hiring.
- **Wallet:** TON Connect, proof verification, transparent fee breakdown,
  per-deal escrow, delivery/completion/dispute actions, reviews.
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
- Acton/Tolk native-TON escrow contract

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
`easywallet.abbrains.xyz` custom domain, the `easy-wallet-production` D1
database, the private `easy-wallet-media` R2 bucket, and the two-minute
reconciler. Build and validate the exact deploy artifact with:

```bash
npm run cloudflare:check
```

After Cloudflare authentication, create the R2 bucket, apply the checked-in D1
migrations, configure the secret bindings, and deploy:

```bash
npx wrangler r2 bucket create easy-wallet-media
npm run db:migrate:production
npm run deploy:production
```

The existing CNAME at `easywallet.abbrains.xyz` must be removed immediately
before the Worker custom-domain deployment; Cloudflare then creates and manages
the replacement DNS record and certificate.

Set these runtime bindings before enabling payments:

| Binding | Required | Purpose |
| --- | --- | --- |
| `ENVIRONMENT=production` | yes | disables demo seeding |
| `TON_NETWORK=testnet` | yes at first | use `mainnet` only after testnet sign-off |
| `PLATFORM_FEE_ADDRESS` | yes | receives the exact 1% fee from each party after settlement |
| `ESCROW_ARBITRATOR_ADDRESS` | yes | wallet allowed to resolve a disputed on-chain escrow |
| `ESCROW_ARBITRATOR_TELEGRAM_ID` | yes | Telegram operator allowed to prepare dispute resolutions |
| `MINI_APP_URL` | yes | canonical HTTPS deployment URL |
| `TELEGRAM_BOT_TOKEN` | yes, secret | validates Mini App sessions and runs the bot |
| `TELEGRAM_BOT_USERNAME` | yes | builds the wallet return link to the dedicated bot |
| `TELEGRAM_WEBHOOK_SECRET` | yes, secret | authenticates Telegram webhook requests |
| `RECONCILE_SECRET` | yes, secret | protects manual reconciliation fallback |
| `TONCENTER_API_KEY` | recommended, secret | raises TON Center limits |

Do not enable mainnet until all participants can verify mainnet wallets, the fee
and arbitrator addresses are reviewed out-of-band, the escrow contract has an
independent security review, the reconciler has passed testnet failure/replay
tests, and operational moderation is staffed.

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
