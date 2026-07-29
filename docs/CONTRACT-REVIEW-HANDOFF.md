# Independent escrow review handoff

Easy Wallet's native-TON escrow must receive a second review by a person or
organization independent of the implementation before any mainnet payment or
marketing launch. Project contributors and automated agents may prepare this
package and fix findings, but cannot certify their own work as independent.

## Freeze and identify the review target

The reviewer checks out the public repository and records:

```bash
git rev-parse HEAD
git status --short
```

The report must name that exact commit. Any contract, generated wrapper,
payment-construction, or reconciliation change after that commit invalidates
the approval until the reviewer examines the diff.

## In-scope files

- `chain/contracts/EasyWalletEscrow.tolk`
- `chain/contracts/types.tolk`
- `chain/tests/EasyWalletEscrow.test.tolk`
- `chain/Acton.toml`
- `chain/wrappers/EasyWalletEscrow.gen.tolk`
- `chain/wrappers-ts/EasyWalletEscrow.gen.ts`
- `lib/ton-escrow.ts`
- `lib/ton-payment.ts`
- `lib/ton-verification.ts`
- `lib/payment-configuration.ts`
- deal creation, action, resolution, submission, and reconciliation routes
  under `app/api/deals`
- job-application acceptance under `app/api/applications/[id]/accept`
- related database schema, indexes, and migrations under `db` and `drizzle`
- escrow, verification, configuration, and fee tests under `tests`

The deployed Worker configuration, TON provider trust assumptions, Telegram
arbitrator authorization, and the funded drill evidence are also in scope.

## Required independent checks

The reviewer should establish, rather than assume, that:

- the deterministic address commits to one deal's buyer, seller, arbitrator,
  platform recipient, fees, amounts, and deadlines;
- buyer funding deploys the intended code/data and cannot fund an attacker-chosen
  contract through application substitution;
- each of the four roles is distinct before a wallet is asked to sign;
- the platform receives exactly the 1% buyer fee plus 1% seller fee only on a
  seller-release path;
- refund, release, expiry, review-timeout, dispute, and arbitration transitions
  are reachable only by the intended role and state;
- no message can redirect a payout, replay a terminal transition, reinitialize
  the contract, bypass a deadline, or leave a reusable balance;
- reserve, gas, storage, bounce, underfunding, overfunding, and partial-failure
  behavior cannot silently violate accounting;
- the Worker treats wallet submission as untrusted until the pinned code, data,
  sender, amount, body, finality, payouts, and destruction are observed;
- provider outage, malformed data, bounced messages, emulated transactions,
  callback loss, duplicate callbacks, concurrent actions, and chain
  reorganization fail closed;
- database uniqueness and state transitions prevent duplicate live deals,
  duplicate actions, and transaction-reference reuse; and
- no seed phrase, private key, or custodial signing secret exists in the app.

## Reproducible verification

Use the pinned Node/npm and Acton versions from the repository and CI. From a
clean checkout, run:

```bash
npm ci
npm run db:migrate:local
npm run test:unit
npm run types:cloudflare:check
npm run lint
npm run cloudflare:check
npm audit --omit=dev --audit-level=high
cd chain
acton build
acton fmt --check
acton check
acton test
```

The reviewer should add independent negative tests or manual traces for any
invariant not convincingly covered. Passing the repository's own tests is
necessary but is not an independent security conclusion.

## Deliverables

The review report must include:

- reviewer identity, independence statement, date, exact commit, tool versions,
  and scope;
- contract and off-chain threat model;
- every finding with severity, exploit narrative, affected invariant, evidence,
  and remediation;
- explicit coverage of every required check above;
- test commands and results, including any reviewer-authored tests;
- funded testnet drill transaction references reviewed against application and
  D1 evidence; and
- one conclusion: approved for the specified commit, approved after listed
  fixes and retest, or not approved.

Release-blocking findings must be fixed on a new commit and returned to the same
reviewer for retest. Mainnet remains disabled until the owner records the final
review approval and the complete funded-drill evidence.
