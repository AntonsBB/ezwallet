import { Address, beginCell, storeStateInit } from "@ton/core";
import {
  EasyWalletEscrow,
  EscrowAmounts,
  EscrowBuyerSide,
  EscrowSellerSide,
} from "../chain/wrappers-ts/EasyWalletEscrow.gen.ts";

export const ESCROW_FUNDING_RESERVE_NANO = 120_000_000n;
export const ESCROW_ACTION_VALUE_NANO = 50_000_000n;
export const DEFAULT_DELIVERY_WINDOW_SECONDS = 14 * 24 * 60 * 60;
export const DEFAULT_REVIEW_WINDOW_SECONDS = 3 * 24 * 60 * 60;

type Network = "mainnet" | "testnet";

type EscrowTerms = {
  dealId: string;
  buyerAddress: string;
  sellerAddress: string;
  arbitratorAddress: string;
  platformAddress: string;
  baseAmountNano: bigint;
  buyerFeeNano: bigint;
  sellerFeeNano: bigint;
  buyerTotalNano: bigint;
  sellerAmountNano: bigint;
  platformFeeNano: bigint;
  deliveryDeadlineUnix: number;
  reviewWindowSeconds?: number;
  network: Network;
};

function normalize(address: Address, network: Network) {
  return address.toString({
    bounceable: false,
    testOnly: network === "testnet",
  });
}

function assertDistinctAddresses(addresses: Address[]) {
  const unique = new Set(addresses.map((address) => address.toRawString()));
  if (unique.size !== addresses.length) {
    throw new Error("Escrow buyer, seller, arbitrator, and platform must differ.");
  }
}

export function dealIdToUint256(dealId: string) {
  const hex = dealId.replaceAll("-", "");
  if (!/^[a-f0-9]{32}$/i.test(hex)) {
    throw new Error("Deal ID must be a UUID.");
  }
  return BigInt(`0x${hex}`);
}

export function queryIdForDeal(dealId: string) {
  return dealIdToUint256(dealId) & ((1n << 64n) - 1n);
}

export function buildEscrowFundingPayload(dealId: string) {
  return EasyWalletEscrow.createCellOfFundEscrow({
    queryId: queryIdForDeal(dealId),
  })
    .toBoc()
    .toString("base64");
}

export function buildNativeTonEscrow(terms: EscrowTerms) {
  const buyer = Address.parse(terms.buyerAddress);
  const seller = Address.parse(terms.sellerAddress);
  const arbitrator = Address.parse(terms.arbitratorAddress);
  const platform = Address.parse(terms.platformAddress);
  assertDistinctAddresses([buyer, seller, arbitrator, platform]);

  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isInteger(terms.deliveryDeadlineUnix) ||
    terms.deliveryDeadlineUnix <= now
  ) {
    throw new Error("Escrow delivery deadline must be in the future.");
  }
  const reviewWindowSeconds =
    terms.reviewWindowSeconds ?? DEFAULT_REVIEW_WINDOW_SECONDS;
  if (
    !Number.isInteger(reviewWindowSeconds) ||
    reviewWindowSeconds < 3_600 ||
    reviewWindowSeconds > 2_592_000
  ) {
    throw new Error("Escrow review window is outside the allowed range.");
  }

  const contract = EasyWalletEscrow.fromStorage({
    dealId: dealIdToUint256(terms.dealId),
    buyerSide: {
      ref: EscrowBuyerSide.create({ buyer, arbitrator }),
    },
    sellerSide: {
      ref: EscrowSellerSide.create({
        seller,
        platformFeeRecipient: platform,
      }),
    },
    amounts: {
      ref: EscrowAmounts.create({
        baseAmount: terms.baseAmountNano,
        buyerFee: terms.buyerFeeNano,
        sellerFee: terms.sellerFeeNano,
        buyerTotal: terms.buyerTotalNano,
        sellerProceeds: terms.sellerAmountNano,
        platformFee: terms.platformFeeNano,
      }),
    },
    deliveryDeadline: BigInt(terms.deliveryDeadlineUnix),
    reviewWindow: BigInt(reviewWindowSeconds),
    reviewDeadline: 0n,
    deliveredEvidenceHash: 0n,
    disputeReasonHash: 0n,
    status: 0n,
  });
  if (!contract.init) {
    throw new Error("Escrow StateInit could not be generated.");
  }

  const stateInit = beginCell()
    .store(storeStateInit(contract.init))
    .endCell()
    .toBoc()
    .toString("base64");
  const fundingPayload = buildEscrowFundingPayload(terms.dealId);

  return {
    address: normalize(contract.address, terms.network),
    codeHash: EasyWalletEscrow.CodeCell.hash().toString("hex"),
    dataHash: contract.init.data.hash().toString("hex"),
    stateInit,
    fundingPayload,
    fundingAmountNano:
      terms.buyerTotalNano + ESCROW_FUNDING_RESERVE_NANO,
    deliveryDeadlineUnix: terms.deliveryDeadlineUnix,
    reviewWindowSeconds,
  };
}

export function buildEscrowActionPayload(
  dealId: string,
  action:
    | "mark_delivered"
    | "confirm_received"
    | "dispute"
    | "refund_expired"
    | "release_after_review",
  detailHash = 0n
) {
  const queryId = queryIdForDeal(dealId);
  let body;
  switch (action) {
    case "mark_delivered":
      body = EasyWalletEscrow.createCellOfMarkDelivered({
        queryId,
        evidenceHash: detailHash,
      });
      break;
    case "confirm_received":
      body = EasyWalletEscrow.createCellOfConfirmDelivery({ queryId });
      break;
    case "dispute":
      body = EasyWalletEscrow.createCellOfOpenDispute({
        queryId,
        reasonHash: detailHash,
      });
      break;
    case "refund_expired":
      body = EasyWalletEscrow.createCellOfRefundExpired({ queryId });
      break;
    case "release_after_review":
      body = EasyWalletEscrow.createCellOfReleaseAfterReview({ queryId });
      break;
  }
  return body.toBoc().toString("base64");
}

export function buildEscrowResolutionPayload(
  dealId: string,
  releaseToSeller: boolean
) {
  return EasyWalletEscrow.createCellOfResolveDispute({
    queryId: queryIdForDeal(dealId),
    releaseToSeller,
  })
    .toBoc()
    .toString("base64");
}

export async function textToUint256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return BigInt(
    `0x${Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")}`
  );
}
