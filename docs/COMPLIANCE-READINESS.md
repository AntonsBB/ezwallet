# Compliance and identity-verification readiness

Easy Wallet is not represented as licensed, KYC-complete, AML-complete, or
ready for regulated mainnet activity. A wallet signature proves control of an
address; it does not prove a legal identity, source of funds, sanctions status,
age, residence, or authority to act for a business.

## Current verified behavior

- Wallet proof creates the marketplace account and establishes control of the
  current settlement address.
- Public trust labels are derived only from live, non-expired provider
  attestations and real marketplace activity.
- The database stores provider references only as hashes. Identity documents,
  selfies, biometrics, and raw provider payloads are not stored in D1.
- The owner-only status API truthfully reports that onboarding is unavailable
  until a regulated verification provider is configured.
- Wallet addresses and wallet balances are excluded from the public storefront
  response.
- No identity, AML, sanctions, or business badge may be granted by an operator
  editing a profile field.

## Required legal and provider decisions

Before identity onboarding or mainnet payments can be enabled, the operator
needs written advice from qualified Latvian/EU counsel on the product's exact
classification, including its marketplace fee, transaction construction,
escrow contracts, arbitration role, and any future cross-chain or stablecoin
rail. Latvijas Banka states that a legal person providing crypto-asset services
professionally must obtain MiCA authorisation, and that the relevant
requirements have applied since 30 December 2024:

- https://www.bank.lv/en/operational-areas/licensing/crypto-asset/crypto-asset-service-providers
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1114

The provider and operating procedure must also be designed against applicable
customer due-diligence, risk-assessment, sanctions, beneficial-owner,
record-retention, suspicious-activity, and crypto-asset transfer-information
requirements. Primary references:

- https://eur-lex.europa.eu/eli/reg/2024/1624/oj/eng
- https://www.eba.europa.eu/activities/single-rulebook/regulatory-activities/anti-money-laundering-and-countering-financing-terrorism/guidelines-information-requirements-relation-transfers-funds-and-certain-crypto-assets-transfers?version=2024

This document is an engineering gate, not legal advice.

## Provider integration contract

A provider integration must not be merged until it has:

1. A signed data-processing agreement, supported-country and age policy, lawful
   basis, retention/deletion schedule, subprocessors, and incident contacts.
2. Hosted or SDK-based capture that keeps identity documents out of Easy
   Wallet infrastructure.
3. A server-created verification session bound to the authenticated Easy Wallet
   user and an unpredictable state value.
4. Signed webhooks with replay protection, timestamp validation, idempotency,
   strict status mapping, and fail-closed unknown-event handling.
5. A one-way hash of the provider reference in D1. Raw documents and provider
   decision payloads must remain at the provider.
6. Explicit expiry and revocation handling. An expired or revoked attestation
   must remove the public badge immediately.
7. Manual-review and appeal procedures that do not reveal sanctions or fraud
   signals publicly.
8. Tests for identity swapping, duplicate accounts, webhook replay, stale
   approvals, provider outage, deletion, and access-control failures.

## Public levels

| Public label | Required evidence |
| --- | --- |
| Not verified | No current wallet proof |
| Wallet proof | Current cryptographic wallet-control proof |
| Identity verified | Current provider identity attestation |
| Enhanced verified | Current identity and address attestations |
| Business verified | Current identity and business attestations |

Sanctions-screen results are never exposed as a public badge. Real deal counts
and review summaries remain separate from identity verification so activity
cannot be mistaken for KYC.

## Mainnet gate

Mainnet remains disabled until:

- counsel confirms the operating model and required authorisations;
- a compliant entity, privacy notice, terms, support process, and responsible
  operators are in place;
- a reviewed provider is integrated and the relevant users have completed its
  real checks;
- platform-fee and arbitrator roles have genuinely distinct controllers;
- funded buyer/seller/arbitrator testnet drills and independent contract review
  are complete;
- incident response, sanctions escalation, dispute handling, and transaction
  monitoring are staffed and tested.
