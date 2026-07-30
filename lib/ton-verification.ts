import { Address, Cell } from "@ton/core";
import { dealIdToUint256, queryIdForDeal } from "@/lib/ton-escrow";

export type TonMessage = {
  bounced?: boolean;
  created_at?: string;
  destination?: string;
  hash?: string;
  in_msg_tx_hash?: string;
  out_msg_tx_hash?: string;
  source?: string;
  value?: string;
  message_content?: {
    body?: string;
    decoded?: Record<string, unknown>;
    hash?: string;
  };
};

export type TonAccountState = {
  account_status?: string;
  code_hash?: string;
  data_hash?: string;
};

export type TonTransaction = {
  account?: string;
  account_state_after?: TonAccountState;
  account_state_before?: TonAccountState;
  emulated?: boolean;
  end_status?: string;
  hash?: string;
  mc_block_seqno?: number;
  now?: number;
  out_msgs?: TonMessage[];
  description?: {
    aborted?: boolean;
    destroyed?: boolean;
    installed?: boolean;
    action?: {
      success?: boolean;
      valid?: boolean;
    };
    compute_ph?: {
      success?: boolean;
    };
  };
  in_msg?: TonMessage;
};

export type SettlementDeal = {
  id: string;
  escrowAddress: string | null;
  buyerWalletAddress: string;
  sellerWalletAddress: string;
  platformWalletAddress: string;
  sellerAmountNano: string;
  platformFeeNano: string;
};

export function sameAddress(left: string | undefined, right: string) {
  if (!left) return false;
  try {
    return Address.parse(left).toRawString() === Address.parse(right).toRawString();
  } catch {
    return false;
  }
}

function cellHash(value: string | undefined) {
  if (!value) return null;
  try {
    return Cell.fromBase64(value).hash().toString("hex");
  } catch {
    return null;
  }
}

export function sameBody(value: string | undefined, expectedBase64: string) {
  return cellHash(value) === cellHash(expectedBase64);
}

export function normalizedTonHash(value: string | undefined) {
  if (!value) return null;
  const hex = value.replace(/^0x/i, "");
  if (/^[a-f0-9]{64}$/i.test(hex)) return hex.toLowerCase();

  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) =>
      character.charCodeAt(0)
    );
    if (bytes.length !== 32) return null;
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  } catch {
    return null;
  }
}

export function sameHash(value: string | undefined, expectedHex: string) {
  return normalizedTonHash(value) === expectedHex.toLowerCase();
}

export function hashesEqual(
  left: string | undefined,
  right: string | undefined
) {
  const normalizedLeft = normalizedTonHash(left);
  return (
    normalizedLeft !== null && normalizedLeft === normalizedTonHash(right)
  );
}

export class TonProviderUnavailableError extends Error {}

export async function lookupFinalizedContractMessage(input: {
  baseUrl: string;
  source: string;
  destination: string;
  amountNano: string;
  payloadBase64: string;
  expectedCodeHash: string;
  expectedDataHash?: string;
  startUnix: number;
  phase: "deploy" | "action";
  headers?: HeadersInit;
  fetcher?: typeof fetch;
}) {
  const query = new URLSearchParams({
    source: Address.parse(input.source).toRawString(),
    destination: Address.parse(input.destination).toRawString(),
    start_utime: String(Math.max(0, input.startUnix - 60)),
    exclude_externals: "true",
    limit: "30",
    sort: "desc",
  });
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(
    `${input.baseUrl.replace(/\/$/, "")}/messages?${query}`,
    {
      headers: input.headers,
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!response.ok) {
    throw new TonProviderUnavailableError(
      `TON Center messages request failed with ${response.status}.`
    );
  }
  const data = (await response.json()) as { messages?: TonMessage[] };
  const message =
    data.messages?.find(
      (candidate) =>
        !candidate.bounced &&
        candidate.value === input.amountNano &&
        sameAddress(candidate.source, input.source) &&
        sameAddress(candidate.destination, input.destination) &&
        sameBody(candidate.message_content?.body, input.payloadBase64) &&
        Boolean(candidate.out_msg_tx_hash) &&
        Boolean(candidate.in_msg_tx_hash)
    ) ?? null;
  if (!message?.in_msg_tx_hash) return null;

  const transactionResponse = await fetcher(
    `${input.baseUrl.replace(/\/$/, "")}/transactions?${new URLSearchParams({
      hash: message.in_msg_tx_hash,
      limit: "1",
    })}`,
    {
      headers: input.headers,
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!transactionResponse.ok) {
    throw new TonProviderUnavailableError(
      `TON Center transaction request failed with ${transactionResponse.status}.`
    );
  }
  const transactionData = (await transactionResponse.json()) as {
    transactions?: TonTransaction[];
  };
  const transaction = transactionData.transactions?.[0];
  if (
    !transaction ||
    !hashesEqual(transaction.hash, message.in_msg_tx_hash) ||
    transaction.emulated === true ||
    !transaction.mc_block_seqno ||
    transaction.description?.aborted ||
    transaction.description?.compute_ph?.success === false ||
    transaction.description?.action?.success === false ||
    transaction.description?.action?.valid === false ||
    !sameAddress(transaction.account, input.destination) ||
    !hashesEqual(transaction.in_msg?.hash, message.hash) ||
    transaction.in_msg?.value !== input.amountNano ||
    !sameAddress(transaction.in_msg?.source, input.source) ||
    !sameAddress(transaction.in_msg?.destination, input.destination) ||
    !sameBody(transaction.in_msg?.message_content?.body, input.payloadBase64)
  ) {
    return null;
  }

  const state =
    input.phase === "deploy"
      ? transaction.account_state_after
      : transaction.account_state_before;
  if (!sameHash(state?.code_hash, input.expectedCodeHash)) return null;
  if (
    input.phase === "deploy" &&
    input.expectedDataHash &&
    !sameHash(state?.data_hash, input.expectedDataHash)
  ) {
    return null;
  }
  if (
    input.phase === "deploy" &&
    (transaction.description?.installed === false ||
      transaction.account_state_after?.account_status === "nonexist")
  ) {
    return null;
  }

  return { message, transaction };
}

function payoutMessageMatches(
  message: TonMessage,
  input: {
    escrowAddress: string;
    destination: string;
    dealId: string;
    payoutKind: number;
    amountNano?: string;
  }
) {
  if (
    message.bounced ||
    !sameAddress(message.source, input.escrowAddress) ||
    !sameAddress(message.destination, input.destination) ||
    (input.amountNano !== undefined && message.value !== input.amountNano)
  ) {
    return false;
  }
  const body = message.message_content?.body;
  if (!body) return false;
  try {
    const slice = Cell.fromBase64(body).beginParse();
    return (
      slice.loadUint(32) === 0xea5e0008 &&
      slice.loadUintBig(64) === queryIdForDeal(input.dealId) &&
      slice.loadUintBig(256) === dealIdToUint256(input.dealId) &&
      slice.loadUint(8) === input.payoutKind
    );
  } catch {
    return false;
  }
}

export function terminalPayoutsMatch(
  transaction: TonTransaction,
  deal: SettlementDeal,
  outcome: "release" | "refund"
) {
  if (
    transaction.description?.destroyed !== true ||
    !deal.escrowAddress ||
    !transaction.out_msgs
  ) {
    return false;
  }
  const payoutMessages = transaction.out_msgs.filter((message) =>
    sameAddress(message.source, deal.escrowAddress!)
  );
  if (payoutMessages.length !== transaction.out_msgs.length) return false;
  if (outcome === "refund") {
    return (
      payoutMessages.length === 1 &&
      payoutMessages.some((message) =>
        payoutMessageMatches(message, {
          escrowAddress: deal.escrowAddress!,
          destination: deal.buyerWalletAddress,
          dealId: deal.id,
          payoutKind: 4,
        })
      )
    );
  }
  if (payoutMessages.length !== 3) return false;
  return (
    payoutMessages.some((message) =>
      payoutMessageMatches(message, {
        escrowAddress: deal.escrowAddress!,
        destination: deal.sellerWalletAddress,
        dealId: deal.id,
        payoutKind: 1,
        amountNano: deal.sellerAmountNano,
      })
    ) &&
    payoutMessages.some((message) =>
      payoutMessageMatches(message, {
        escrowAddress: deal.escrowAddress!,
        destination: deal.platformWalletAddress,
        dealId: deal.id,
        payoutKind: 2,
        amountNano: deal.platformFeeNano,
      })
    ) &&
    payoutMessages.some((message) =>
      payoutMessageMatches(message, {
        escrowAddress: deal.escrowAddress!,
        destination: deal.buyerWalletAddress,
        dealId: deal.id,
        payoutKind: 3,
      })
    )
  );
}
