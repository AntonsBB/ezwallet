# Funded TON testnet drill

This runbook is the payment release gate for Easy Wallet. It uses genuine
Telegram identities, genuine TON testnet wallets, and finalized testnet
transactions. It must not be replaced with seeded rows, mocked provider
responses, screenshots without transaction evidence, or a mainnet transaction.

## Required participants and inputs

Before enabling the payment gate, the owner supplies:

1. a platform-fee TON wallet address whose controller has been verified
   out-of-band;
2. a separate arbitrator TON wallet address;
3. the Telegram numeric user ID of the person controlling that arbitrator
   wallet; and
4. a buyer and seller who each control a separate Telegram account and a
   separate TON testnet wallet.

Buyer, seller, arbitrator, and platform wallets must be four distinct TON
accounts. The arbitrator must open Easy Wallet from the configured Telegram
account and complete TON proof with the configured arbitrator wallet. Never
send a seed phrase, private key, wallet backup, bot token, or Cloudflare secret
to the project, another participant, a reviewer, or a chat.

## Preconditions

- Record the exact Git commit and deployed Cloudflare Worker version.
- Confirm `TON_NETWORK=testnet` in the deployed Worker.
- Have two people compare the platform and arbitrator addresses through a
  second channel before configuring them.
- Store `PLATFORM_FEE_ADDRESS`, `ESCROW_ARBITRATOR_ADDRESS`, and
  `ESCROW_ARBITRATOR_TELEGRAM_ID` as Cloudflare bindings. Do not commit their
  values.
- Fetch `/api/bootstrap` and confirm `paymentsReady` is `true`,
  `paymentBlockers` is empty, and `network` is `testnet`.
- Confirm buyer, seller, and arbitrator each see “Address verified with TON
  proof” for the correct testnet wallet.
- Fund only the participating testnet wallets with the minimum testnet TON
  needed for the planned transactions and gas.
- Confirm the independent contract review described in
  [`CONTRACT-REVIEW-HANDOFF.md`](CONTRACT-REVIEW-HANDOFF.md) is underway or
  complete. Its approval remains mandatory before mainnet.

If any wallet shows mainnet, any address differs between reviewers, or the
public readiness response is inconsistent, stop before opening the wallet
confirmation.

## Drill A: buyer-confirmed settlement

1. The seller creates one truthful, clearly test-labeled listing using the
   seller's real Telegram account. Record the listing ID.
2. The buyer opens that listing and reviews the exact base price, 1% buyer fee,
   1% seller fee, escrow reserve, and total wallet request.
3. Before signing, verify the TON Connect request contains one message to the
   newly derived escrow address on testnet. Abort if it contains a direct
   platform or seller transfer.
4. The buyer signs. Record the returned deal ID and the finalized funding
   transaction hash. A wallet submission alone is not a pass.
5. Wait for the reconciler to advance the deal from `payment_submitted` to
   `awaiting_delivery`. Confirm it matched the pinned contract code/data,
   buyer source, exact amount, and funding payload.
6. The seller submits genuine delivery evidence and signs `mark_delivered`.
   Record the finalized action transaction.
7. The buyer confirms receipt and signs `confirm_received`. Record the
   finalized settlement transaction.
8. Confirm the contract is terminal and destroyed, the seller received exactly
   base minus 1%, and the platform received exactly the buyer and seller fees.
9. Reconcile the deal row, chain-action rows, append-only event history, and
   ledger entries against the finalized chain messages.

## Drill B: arbitrated dispute

Use a new truthful, clearly test-labeled listing and a new deal; do not reuse
the settled contract.

1. Repeat the exact funding checks from Drill A and wait for independently
   verified funding.
2. The seller marks delivery, then the buyer opens a dispute with truthful test
   evidence. Record both finalized action transactions.
3. From the configured arbitrator Telegram account, connect and prove the
   configured arbitrator wallet.
4. Review the immutable buyer, seller, amounts, evidence, and requested
   resolution before signing. The arbitrator may only choose the contract's
   fixed seller-release or buyer-refund path.
5. Sign one resolution, record the finalized transaction, and verify the exact
   terminal payout, contract destruction, action record, event history, and
   ledger state.
6. Repeat on a third deal for the opposite arbitration outcome so both release
   and refund branches are exercised.

## Adversarial and recovery checks

Run these without inventing a successful result:

- Lose the browser callback after one funded transaction and confirm scheduled
  reconciliation recovers it without a second deal or payment.
- Retry a submitted callback and confirm the transaction reference remains
  unique and the state transition is idempotent.
- Temporarily make the TON provider unavailable in an isolated test
  environment. Confirm the deal remains pending and is not treated as unfunded.
- Attempt each action from the wrong verified wallet and from the wrong
  Telegram account. Confirm it fails without preparing a wallet request.
- Confirm a reused platform/arbitrator wallet, malformed address, or missing
  arbitrator operator makes `paymentsReady=false`.
- Confirm an unexpected contract hash, source, amount, body, payout set, bounced
  message, or emulated transaction never advances the authoritative state.

## Evidence and stop conditions

For every step, retain the timestamp, participant role, deal ID, escrow
address, transaction hash, block/sequence reference, expected and observed
amounts, code/data hashes, API state, and D1 event/action/ledger references.
Keep Telegram launch data, tokens, secrets, and private keys out of the record.

Stop the drill and keep payments disabled if:

- any transaction is on mainnet;
- a wallet or Telegram identity does not match the reviewed role;
- the wallet request contains an unexpected recipient, message, or amount;
- the provider cannot independently verify a finalized message;
- a state advances before its on-chain evidence is verified;
- reconciliation, payout, event history, or ledger records disagree; or
- any participant cannot explain what they are signing.

The gate passes only after all three funded testnet deals, both arbitration
outcomes, the recovery/adversarial checks, and the independent review have
documented evidence with no unresolved release-blocking finding.
