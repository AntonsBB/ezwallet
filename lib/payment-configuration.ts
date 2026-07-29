import { Address } from "@ton/core";
import type { PaymentBlocker, TonNetwork } from "./payment-readiness.ts";

type PaymentConfigurationInput = {
  network: TonNetwork;
  platformFeeAddress?: string;
  arbitratorAddress?: string;
};

type ReadyPaymentConfiguration = {
  ready: true;
  blockers: [];
  network: TonNetwork;
  platformWalletAddress: string;
  arbitratorWalletAddress: string;
};

type BlockedPaymentConfiguration = {
  ready: false;
  blockers: PaymentBlocker[];
  network: TonNetwork;
};

export type PaymentConfiguration =
  | ReadyPaymentConfiguration
  | BlockedPaymentConfiguration;

export function normalizeTonAddress(value: string, network: TonNetwork) {
  return Address.parse(value).toString({
    bounceable: false,
    testOnly: network === "testnet",
  });
}

export function inspectPaymentConfiguration(
  input: PaymentConfigurationInput
): PaymentConfiguration {
  const blockers: PaymentBlocker[] = [];
  let platform: Address | undefined;
  let arbitrator: Address | undefined;

  if (!input.platformFeeAddress?.trim()) {
    blockers.push("platform_wallet_missing");
  } else {
    try {
      platform = Address.parse(input.platformFeeAddress.trim());
    } catch {
      blockers.push("platform_wallet_invalid");
    }
  }

  if (!input.arbitratorAddress?.trim()) {
    blockers.push("arbitrator_wallet_missing");
  } else {
    try {
      arbitrator = Address.parse(input.arbitratorAddress.trim());
    } catch {
      blockers.push("arbitrator_wallet_invalid");
    }
  }

  if (
    platform &&
    arbitrator &&
    platform.toRawString() === arbitrator.toRawString()
  ) {
    blockers.push("wallet_roles_not_distinct");
  }

  if (blockers.length || !platform || !arbitrator) {
    return { ready: false, blockers, network: input.network };
  }

  return {
    ready: true,
    blockers: [],
    network: input.network,
    platformWalletAddress: normalizeTonAddress(
      platform.toRawString(),
      input.network
    ),
    arbitratorWalletAddress: normalizeTonAddress(
      arbitrator.toRawString(),
      input.network
    ),
  };
}
