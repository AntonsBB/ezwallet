# Security policy

Easy Wallet handles marketplace identity, user-generated content, and non-custodial cryptocurrency payment metadata. Security reports are welcome.

## Reporting a vulnerability

Please do not open a public issue for an exploitable vulnerability or include real user data, bot tokens, wallet secrets, or private keys in a report.

Until a dedicated security address is published, use GitHub's private vulnerability reporting feature for this repository.

Include:

- affected route or component;
- reproducible steps;
- expected and actual behavior;
- security impact;
- a minimal proof of concept using test accounts and TON testnet where possible.

## Scope

High-priority areas include:

- wallet session theft, fixation, revocation, CSRF, or replay;
- optional Telegram Mini App init-data validation or replay;
- session fixation, CSRF, authorization, or IDOR;
- TON proof validation or wallet/account substitution;
- escrow code/data substitution, payment amount, recipient, fee, deadline,
  network, action, or status manipulation;
- unauthorized delivery, release, refund, or dispute resolution;
- duplicate or replayed deals and transactions;
- SQL injection or unsafe query construction;
- unrestricted uploads, stored XSS, content-sniffing, or object access;
- Telegram webhook spoofing;
- secret exposure;
- moderation/reporting bypasses.

## Safe-harbor expectations

Use only accounts and wallets you own or have explicit permission to test. Do not degrade availability, access other users' private data, move real funds, spam Telegram users, or test against mainnet when testnet can demonstrate the issue.

## Supported versions

Only the latest production deployment and the default branch receive security updates before the first stable release.

## Security model

- Easy Wallet is non-custodial and never requests seed phrases or private keys.
- A wallet-signed submission is not considered confirmed funding or settlement
  until independently verified on-chain.
- Native-TON escrow remains testnet-only until the contract and reconciliation
  paths receive independent security review and end-to-end adversarial testing.
- TON wallet ownership proof is the primary account check. Optional Telegram
  identity is a distinct compatibility check and does not authorize escrow
  arbitration.
- Government-ID, NFC passport, custody, fiat exchange, and tax-reporting systems are not part of the initial public release.
