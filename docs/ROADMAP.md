# Easy Wallet production roadmap

This roadmap is ordered by launch risk. A later phase cannot weaken or bypass
the gates in an earlier phase. The recurring task heartbeat may advance safe
local work and the public draft pull request, but it does not authorize mainnet
funds, external promotion, bot deletion, or unattended account changes.

## 1. Testnet escrow foundation

- [x] Freeze buyer, seller, platform, arbitrator, amounts, fees, deadlines, and
  network when a deal is created.
- [x] Enforce exact 1% buyer and 1% seller fees with integer nanotons.
- [x] Atomically deploy and fund one deterministic native-TON contract per deal.
- [x] Implement delivery, confirmation, dispute, expiry refund, review-window
  release, and arbitrator release/refund.
- [x] Pin and verify contract code/data hashes, messages, terminal payouts, and
  contract destruction in the independent reconciler.
- [x] Recover lost browser callbacks and expire stale requests only after an
  available provider finds no finalized transaction.
- [x] Prevent duplicate active deals and duplicate pending chain actions.
- [ ] Add mocked TON Center response/replay/failure integration tests.
- [ ] Run a second independent contract/security review.
- [ ] Complete two-party testnet settlement and dispute drills.

## 2. Stable Cloudflare production environment

- [x] Define the exact Worker, static asset, D1, private R2, cron, observability,
  and custom-domain configuration.
- [x] Verify a production build and Wrangler upload dry-run.
- [x] Verify all D1 migrations against a fresh database.
- [ ] Restore Cloudflare authorization.
- [ ] Enable R2 and create the private `easy-wallet-media` bucket.
- [ ] Apply the remote D1 migrations.
- [ ] Configure encrypted Telegram, webhook, reconciler, and TON Center secrets.
- [ ] Configure reviewed testnet platform and arbitrator addresses.
- [ ] Remove the old CNAME and deploy the Worker custom domain.
- [ ] Verify TLS, security headers, manifest, webhook, cron, D1, R2, and rollback.

## 3. Dedicated Telegram identity

- [ ] Create a new Easy Wallet bot in BotFather after stable HTTPS is live.
- [ ] Store its token only in Cloudflare's encrypted secret store.
- [ ] Configure the menu Mini App, domain, description, avatar, commands, and
  secret-validated webhook.
- [ ] Verify Telegram iOS, Android, Desktop, and Web launch flows.
- [ ] Send the stable Mini App link to Bamboo without modifying Bamboo itself.

## 4. Marketplace and local work product

- [ ] Expand Market into a category-led Facebook Marketplace-style browse flow.
- [ ] Add saved searches, favorites, listing lifecycle controls, and stronger
  seller/reputation context.
- [ ] Select one of the prepared Work map directions.
- [ ] Add privacy-preserving approximate coordinates and radius filters.
- [ ] Implement map/list synchronization, distance sorting, and manual-location
  fallback without publishing private exact addresses.
- [ ] Complete delivery evidence, dispute evidence, moderator queue, and
  arbitrator decision history.
- [ ] Complete empty, loading, offline, retry, error, and restricted-account
  states for every core journey.

## 5. Release verification

- [ ] Pass unit, API, contract emulator, migration, production build, and CI
  checks from a clean checkout.
- [ ] Pass keyboard, screen-reader, contrast, reduced-motion, and mobile viewport
  checks.
- [ ] Pass replay, IDOR, CSRF, upload, webhook, wallet substitution, provider
  outage, callback loss, concurrency, and rate-limit tests.
- [ ] Complete dependency, secret, static, dynamic, and contract security scans.
- [ ] Publish operational runbooks for disputes, provider outage, compromised bot
  token, failed deployment, and incident response.

## 6. User acceptance and mainnet gate

- [ ] The owner and one trusted friend complete the agreed real-user test.
- [ ] Reconcile every wallet, contract, payout, ledger, and review record.
- [ ] Fix every release-blocking defect and repeat the test.
- [ ] Obtain explicit owner approval before changing `TON_NETWORK` to mainnet.
- [ ] Keep unsupported native BTC, ETH, SOL, XRP, and other cross-chain balances
  out of TON Connect; add a separate audited rail if they are ever supported.

## 7. Marketing gate

Marketing starts only after the owner accepts the production build and the
mainnet test succeeds.

- [ ] Prepare truthful launch copy, screenshots, FAQ, safety disclosures, and
  support channels.
- [ ] Obtain explicit approval for the campaign and every external account used.
- [ ] Prefer owned profiles and opt-in communities; follow community rules and
  platform anti-spam policies.
- [ ] Measure activation, completed deals, disputes, fraud reports, and support
  load before expanding.
- [ ] Pause promotion automatically if settlement, safety, or support metrics
  exceed the agreed thresholds.
