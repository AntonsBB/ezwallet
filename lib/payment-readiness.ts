export const paymentBlockers = [
  "platform_wallet_missing",
  "platform_wallet_invalid",
  "arbitrator_wallet_missing",
  "arbitrator_wallet_invalid",
  "wallet_roles_not_distinct",
] as const;

export type PaymentBlocker = (typeof paymentBlockers)[number];
export type TonNetwork = "mainnet" | "testnet";

export function paymentReadinessMessage(
  blockers: readonly PaymentBlocker[],
  network: TonNetwork
) {
  if (
    blockers.includes("platform_wallet_invalid") ||
    blockers.includes("arbitrator_wallet_invalid") ||
    blockers.includes("wallet_roles_not_distinct")
  ) {
    return `Payments are paused because the ${network} fee and arbitration configuration needs review.`;
  }

  const missing: string[] = [];
  if (blockers.includes("platform_wallet_missing")) {
    missing.push("platform fee wallet");
  }
  if (blockers.includes("arbitrator_wallet_missing")) {
    missing.push("arbitrator wallet");
  }
  if (missing.length === 0) {
    return `Payments are paused while the ${network} escrow configuration is checked.`;
  }
  const requirements =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`;
  return `Payments are paused until the ${network} ${requirements} ${
    missing.length === 1 ? "is" : "are"
  } configured.`;
}
