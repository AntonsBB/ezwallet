# Easy Wallet escrow contracts

This directory contains the on-chain escrow layer for Easy Wallet. It uses the
current TON toolchain: Tolk contracts built and tested with Acton.

The first contract supports native TON settlement. Every deal receives a
deterministic contract address with immutable buyer, seller, arbitrator, fee
recipient, amount, fee, and timing terms. The buyer funds the contract directly
from their wallet. Funds can leave only through:

- buyer-confirmed release to the fixed seller and fee recipient;
- automatic release after the seller's delivery review window;
- buyer refund after an undelivered deal expires; or
- an arbitrator decision that can only select the fixed release or refund path.

The contract has no upgrade operation and cannot redirect funds to arbitrary
addresses. It must remain testnet-only until the source is independently
reviewed, its deployed code hash is verified, and all contract tests and
application end-to-end tests pass.

USDT-on-TON requires a separate Jetton escrow implementation because Jetton
transfers are asynchronous contract messages. It must not be emulated as native
TON or enabled by a configuration flag before those tests and validations exist.
