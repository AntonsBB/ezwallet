export const NANO_PER_TON = 1_000_000_000n;
export const PLATFORM_FEE_BPS = 100n;
export const BPS_DENOMINATOR = 10_000n;
export const MIN_TRANSACTION_AMOUNT_NANO = 1_000_000n;

export function tonToNano(input: string) {
  const normalized = input.trim();
  if (!/^\d{1,7}(?:\.\d{1,9})?$/.test(normalized)) {
    throw new Error("Enter a valid TON amount.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return (
    BigInt(whole) * NANO_PER_TON +
    BigInt(fraction.padEnd(9, "0"))
  ).toString();
}

export function marketplaceAmountToNano(input: string) {
  const amountNano = tonToNano(input);
  if (BigInt(amountNano) < MIN_TRANSACTION_AMOUNT_NANO) {
    throw new Error("The minimum transaction amount is 0.001 TON.");
  }
  return amountNano;
}

export function nanoToTon(input: string, maximumFractionDigits = 2) {
  const value = BigInt(input);
  const whole = value / NANO_PER_TON;
  const fraction = (value % NANO_PER_TON).toString().padStart(9, "0");
  const trimmed = fraction.slice(0, maximumFractionDigits).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

export function calculateTransactionFees(baseNano: bigint) {
  if (baseNano <= 0n) {
    throw new Error("The transaction amount must be positive.");
  }

  const partyFeeNano =
    (baseNano * PLATFORM_FEE_BPS + BPS_DENOMINATOR - 1n) /
    BPS_DENOMINATOR;
  if (partyFeeNano >= baseNano) {
    throw new Error("The transaction amount is too small.");
  }

  const buyerFeeNano = partyFeeNano;
  const sellerFeeNano = partyFeeNano;
  const platformFeeNano = buyerFeeNano + sellerFeeNano;

  return {
    baseNano,
    buyerFeeNano,
    sellerFeeNano,
    buyerTotalNano: baseNano + buyerFeeNano,
    platformFeeNano,
    sellerAmountNano: baseNano - sellerFeeNano,
  };
}
