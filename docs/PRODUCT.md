# EzWallet product specification

EzWallet is a Telegram Mini App for local and remote peer-to-peer trade. It combines:

- Market: physical and digital goods.
- Work: services, micro-jobs, on-site jobs, remote work, and project hiring.
- Wallet: a non-custodial TON Connect interface for user-approved payments.
- Profile: Telegram identity, wallet verification, reputation, reviews, listings, deals, and safety controls.

The wallet supports the marketplace. EzWallet never receives seed phrases, stores private keys, or presents an internal balance as if it were on-chain money.

## Product principles

1. Ordinary people should be able to buy, sell, work, and hire without learning financial or business jargon.
2. Each important action should be visible, reversible until commitment, and confirmed in plain language.
3. Identity collection is minimized. Telegram authentication identifies the account; TON proof binds a wallet; government-document verification is not implemented without a qualified provider and a separate legal/security review.
4. Every deal uses the same disclosed platform fee: 1% of the deal amount.
5. A browser response never proves payment. Payment records remain pending until the backend confirms the expected on-chain transfers.
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

The production interface keeps the source identity while removing the old presentation-video phone mockup. Telegram provides the device shell.

## Core journeys

### Browse and buy

1. Open the Mini App from the Telegram bot.
2. Telegram init data is validated by the backend.
3. Browse or filter active Market listings.
4. Open a listing and inspect seller reputation, delivery, price, and safety notes.
5. Connect and verify a TON wallet.
6. Review an immutable quote showing gross price, 1% platform fee, seller proceeds, recipients, and network.
7. Approve a two-recipient transaction in the wallet.
8. EzWallet records the signed submission as pending.
9. The payment monitor confirms the expected seller and platform transfers on-chain.
10. Buyer and seller coordinate delivery, mark completion, and may review each other.

### Find work

1. Browse services and jobs by category, work mode, location, and radius.
2. Buy a fixed-price service or apply to a posted job.
3. The owner accepts one application and the system creates a deal.
4. Payment, delivery/proof, completion, dispute, and review follow the same auditable deal lifecycle.

### Sell or hire

1. Create a Market listing, service, or job.
2. Upload supported images and provide a realistic description, price/budget, delivery method, and location.
3. Publish, pause, edit, or close the post.
4. Manage applications and active deals from Profile.

### Wallet

1. Connect a compatible TON wallet through TON Connect.
2. Complete a server-issued `ton_proof` challenge before the address is saved to the profile.
3. View the verified address, network, recent EzWallet deals, and on-chain balance when the configured provider is available.
4. Every transfer is approved in the wallet. EzWallet cannot sign on the user's behalf.

## Deal and fee rules

- Fee basis points: `100`.
- `platform_fee = max(1 nanotON, floor(gross * 100 / 10_000))`.
- `seller_proceeds = gross - platform_fee`.
- The quote is stored when a deal is created and is not recalculated from later listing edits.
- The transaction request contains seller proceeds and platform fee as separate messages.
- A unique deal reference is included for backend matching.
- The platform marks payment confirmed only after both expected transfers are finalized.
- Rounding is deterministic and covered by automated tests.

## Deal lifecycle

`pending_wallet` → `payment_submitted` → `payment_confirmed` → `in_progress` → `delivered` → `completed`

Alternative terminal or review states:

- `expired`
- `cancelled`
- `payment_failed`
- `disputed`
- `refunded`

Only valid transitions are accepted by the API. Each transition is recorded in an append-only deal event log.

## Safety and moderation

- report a listing, job, profile, message reference, or deal;
- block another user;
- hide paused, closed, moderated, or sold posts from discovery;
- rate and review only after a completed deal;
- preserve reports and financial audit records even when public content is removed;
- disclose that EzWallet is not an escrow or custody provider unless a separately audited escrow contract is introduced;
- prohibit illegal goods, fraud, stolen assets, impersonation, harassment, and attempts to bypass platform safety controls.

## Launch acceptance criteria

- Telegram init data validation rejects tampering, expired launches, and malformed users.
- Wallet addresses cannot be attached without a valid one-time TON proof.
- Market and Work discovery, create/edit/pause flows, applications, deals, completion, reviews, and reports work against persistent storage.
- Every payable deal displays and records the fixed 1% fee.
- Payment submissions are not presented as confirmed before backend verification.
- Secrets are absent from source control.
- Database migrations, Worker types, lint, typecheck, unit/API tests, production build, browser journeys, accessibility checks, visual QA, and security scan pass.
- A public GitHub repository contains setup, deployment, threat/safety, and contributor documentation.
