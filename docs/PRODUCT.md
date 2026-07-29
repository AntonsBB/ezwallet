# Easy Wallet product specification

Easy Wallet is an installable, wallet-first Web3 app for local and remote
peer-to-peer trade. Telegram can launch the same web app, but is not required.
It combines:

- Market: physical and digital goods.
- Work: services, micro-jobs, on-site jobs, remote work, and project hiring.
- Wallet: non-custodial wallet connection, ownership proof, and user-approved
  settlement actions. TON is the first implemented settlement rail.
- Profile: wallet identity, reputation, reviews,
  listings, deals, and safety controls.

The wallet supports the marketplace. Easy Wallet never receives seed phrases, stores private keys, or presents an internal balance as if it were on-chain money.

## Product principles

1. Ordinary people should be able to buy, sell, work, and hire without learning financial or business jargon.
2. Each important action should be visible, reversible until commitment, and confirmed in plain language.
3. Identity collection is minimized. Wallet ownership proof identifies the
   account. Telegram can launch the PWA but cannot authenticate it.
   Government-document verification is not implemented without a qualified
   provider and a separate legal/security review.
4. Every paid deal charges 1% to the buyer and 1% to the seller, disclosed only
   in the transaction review and wallet-approval flow.
5. A browser response never proves payment. Payment records remain pending until
   the backend confirms the expected escrow deployment, funding, and subsequent
   on-chain state transitions.
6. Reputation comes only from completed deals and cannot be purchased.
7. The platform supports lawful trade and recordkeeping; it does not promise anonymity from legal obligations or tax-free exchange.

## Visual system

The source of truth is the original EzWallet demo:

- white and warm-white surfaces;
- a pale geometric/hexagonal texture used sparingly;
- black geometric EzWallet mark;
- heavy black headlines with restrained supporting type;
- monochrome navigation and one calm green accent for verified/success states;
- phone-first density and four persistent bottom tabs;
- product photography inside clean cards rather than decorative illustration overload.

The production interface keeps the source identity while removing the old
presentation-video phone mockup. The responsive web app provides its own device
shell and can be installed from supported browsers.

## Core journeys

### Browse and buy

1. Open the HTTPS web app in a desktop browser, mobile browser, or compatible
   wallet browser. Telegram is an optional alternate launch path.
2. Browse active Market listings by normalized category, listing type, exact
   TON price range, or price/newest order. Empty results never fabricate stock
   and always offer a clear or create action.
3. Open a listing and inspect seller reputation, delivery, price, safety notes,
   and proof-verified settlement-wallet readiness.
4. Connect and verify a compatible TON wallet through an extension, QR,
   universal link, or in-wallet browser.
5. Review an immutable quote showing the base price, 1% buyer fee, 1% seller fee, buyer total, seller proceeds, recipients, and network.
6. Approve one transaction that atomically deploys and funds the deal's
   deterministic escrow contract.
7. Easy Wallet records the signed submission as pending.
8. The payment monitor confirms the expected contract code, immutable terms,
   sender, amount, and funding payload on-chain.
9. Seller marks delivery on-chain. Buyer confirms release or opens a dispute,
    and both parties may review after verified settlement.

### Find work

1. Browse services and jobs by category, work mode, location, and radius.
2. Buy a fixed-price service or apply to a posted job.
3. The owner accepts one application and the system creates a deal.
4. Payment, delivery/proof, completion, dispute, and review follow the same auditable deal lifecycle.

Map discovery uses approximate public coordinates rounded to roughly a
neighborhood block plus a declared radius. Exact home, workplace, or live device
coordinates are not published in a listing.

### Sell or hire

1. Create a Market listing, service, or job.
2. Upload supported images and provide a realistic description, price/budget, delivery method, and location.
3. Publish, edit, pause, reactivate, or permanently close the post. Section and
   listing type are immutable; edits use the last-seen version and are blocked
   while an application or deal is active.
4. Manage applications and active deals from Profile.

### Wallet

1. Connect a compatible TON wallet through TON Connect.
2. Complete a server-issued, single-use `ton_proof` challenge for the exact app
   domain before a wallet-only profile and browser session are created.
3. View the verified address, network, and recent Easy Wallet deals.
4. Every transfer is approved in the wallet. Easy Wallet cannot sign on the user's behalf.

The product architecture keeps identity, marketplace profiles, and payment
rails separate. Additional chain adapters must implement their own signed
authentication, transaction construction, independent reconciliation, escrow
or dispute design, and security review. The UI and documentation must not imply
native ETH, BTC, SOL, XRP, token, or stablecoin support before those rails exist.

## Deal and fee rules

- Fee basis points per party: `100`.
- `buyer_fee = ceil(base_price * 100 / 10_000)`.
- `seller_fee = ceil(base_price * 100 / 10_000)`.
- `buyer_total = base_price + buyer_fee`.
- `seller_proceeds = base_price - seller_fee`.
- `platform_fee = buyer_fee + seller_fee`.
- The quote is stored when a deal is created and is not recalculated from later listing edits.
- The funding request contains the deterministic escrow `StateInit`, exact
  funding amount, and a deal-specific funding message.
- The contract stores the buyer, seller, arbitrator, platform recipient,
  deadlines, price, fees, and deal identifier as immutable terms.
- The platform marks funding confirmed only after the contract code, state,
  sender, amount, and message are independently verified.
- Settlement pays fixed seller proceeds and the combined platform fee. Any
  remaining reserve is returned to the buyer.
- Rounding is deterministic and covered by automated tests.

## Deal lifecycle

`awaiting_funding` → `funded` → `delivered` → `released`

Alternative terminal or review states:

- `cancelled`
- `disputed`
- `refunded`

Only valid transitions are accepted by the API and the escrow contract. An
expired undelivered escrow can be refunded; a delivered escrow can be released
after the review window; a disputed escrow requires the configured arbitrator.
Each prepared and submitted chain action is recorded for reconciliation.
An unfunded request is cancelled automatically only after its wallet window has
elapsed and an available TON provider finds no matching finalized funding
transaction; this avoids stranding funds after a lost browser callback.

## Safety and moderation

- report a listing, job, profile, message reference, or deal;
- block another user;
- hide paused, closed, moderated, or sold posts from discovery;
- rate and review only after a completed deal;
- preserve reports and financial audit records even when public content is removed;
- disclose that Easy Wallet is non-custodial, that the escrow contract is
  testnet-only until independently reviewed, and that dispute arbitration is a
  trusted operational role;
- prohibit illegal goods, fraud, stolen assets, impersonation, harassment, and attempts to bypass platform safety controls.

## Launch acceptance criteria

- Wallet-only browser sign-in works from every launch surface; Telegram launch
  data is never accepted as application authentication.
- Wallet addresses cannot be attached without a valid one-time TON proof.
- Market and Work discovery, create/edit/pause flows, applications, deals, completion, reviews, and reports work against persistent storage.
- Every payable deal displays and records the fixed 1% fee for each party only
  at transaction time.
- Payment submissions are not presented as confirmed before backend verification.
- Escrow funding, delivery, release, refund, expiry, and dispute scenarios pass
  emulator and application-level tests.
- Secrets are absent from source control.
- Database migrations, Worker types, lint, typecheck, unit/API tests, production build, browser journeys, accessibility checks, visual QA, and security scan pass.
- A public GitHub repository contains setup, deployment, threat/safety, and contributor documentation.
