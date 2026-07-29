import { Address, Cell } from "@ton/core";
import { asc, eq } from "drizzle-orm";
import { getBinding, getDb } from "@/db";
import { dealEvents, deals, ledgerEntries } from "@/db/schema";

type TonMessage = {
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
  };
};

type TonTransaction = {
  account?: string;
  emulated?: boolean;
  hash?: string;
  mc_block_seqno?: number;
  description?: {
    aborted?: boolean;
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

function sameAddress(left: string | undefined, right: string) {
  if (!left) return false;
  try {
    return Address.parse(left).toRawString() === Address.parse(right).toRawString();
  } catch {
    return false;
  }
}

function textComment(message: TonMessage) {
  const decoded = message.message_content?.decoded;
  for (const key of ["text", "comment", "value"]) {
    if (typeof decoded?.[key] === "string") return decoded[key] as string;
  }
  const body = message.message_content?.body;
  if (!body) return "";
  try {
    const slice = Cell.fromBase64(body).beginParse();
    if (slice.remainingBits < 32 || slice.loadUint(32) !== 0) return "";
    return slice.loadStringTail();
  } catch {
    return "";
  }
}

async function findTransfer(input: {
  source: string;
  destination: string;
  amountNano: string;
  comment: string;
  startUnix: number;
  network: "mainnet" | "testnet";
}) {
  const base =
    input.network === "mainnet"
      ? "https://toncenter.com/api/v3"
      : "https://testnet.toncenter.com/api/v3";
  const query = new URLSearchParams({
    source: Address.parse(input.source).toRawString(),
    destination: Address.parse(input.destination).toRawString(),
    start_utime: String(Math.max(0, input.startUnix - 60)),
    direction: "out",
    exclude_externals: "true",
    limit: "30",
    sort: "desc",
  });
  const headers = new Headers();
  const apiKey = getBinding("TONCENTER_API_KEY");
  if (apiKey) headers.set("x-api-key", apiKey);
  const response = await fetch(`${base}/messages?${query}`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { messages?: TonMessage[] };
  const message =
    data.messages?.find(
      (message) =>
        !message.bounced &&
        message.value === input.amountNano &&
        sameAddress(message.source, input.source) &&
        sameAddress(message.destination, input.destination) &&
        textComment(message) === input.comment &&
        Boolean(message.out_msg_tx_hash) &&
        Boolean(message.in_msg_tx_hash)
    ) ?? null;
  if (!message?.in_msg_tx_hash) return null;

  const transactionQuery = new URLSearchParams({
    hash: message.in_msg_tx_hash,
    limit: "1",
  });
  const transactionResponse = await fetch(
    `${base}/transactions?${transactionQuery}`,
    {
      headers,
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!transactionResponse.ok) return null;
  const transactionData = (await transactionResponse.json()) as {
    transactions?: TonTransaction[];
  };
  const transaction = transactionData.transactions?.[0];
  if (
    !transaction ||
    transaction.hash !== message.in_msg_tx_hash ||
    transaction.emulated === true ||
    !transaction.mc_block_seqno ||
    transaction.description?.aborted ||
    transaction.description?.compute_ph?.success === false ||
    transaction.description?.action?.success === false ||
    transaction.description?.action?.valid === false ||
    !sameAddress(transaction.account, input.destination) ||
    transaction.in_msg?.hash !== message.hash ||
    transaction.in_msg?.value !== input.amountNano ||
    !sameAddress(transaction.in_msg?.source, input.source) ||
    !sameAddress(transaction.in_msg?.destination, input.destination) ||
    textComment(transaction.in_msg) !== input.comment
  ) {
    return null;
  }

  return {
    message,
    recipientTransactionHash: transaction.hash,
    masterchainSeqno: transaction.mc_block_seqno,
  };
}

export async function reconcilePendingDeals(limit = 40) {
  const db = getDb();
  const pending = await db
    .select()
    .from(deals)
    .where(eq(deals.status, "payment_submitted"))
    .orderBy(asc(deals.submittedAt))
    .limit(Math.min(limit, 100));
  let confirmed = 0;

  for (const deal of pending) {
    const startUnix = Math.floor(
      Date.parse(deal.submittedAt ?? deal.createdAt) / 1000
    );
    const [sellerMessage, feeMessage] = await Promise.all([
      findTransfer({
        source: deal.buyerWalletAddress,
        destination: deal.sellerWalletAddress,
        amountNano: deal.sellerAmountNano,
        comment: `EZW:${deal.id}:SELLER`,
        startUnix,
        network: deal.network,
      }),
      findTransfer({
        source: deal.buyerWalletAddress,
        destination: deal.platformWalletAddress,
        amountNano: deal.platformFeeNano,
        comment: `EZW:${deal.id}:FEE`,
        startUnix,
        network: deal.network,
      }),
    ]);
    if (!sellerMessage || !feeMessage) continue;

    const verifiedAt = new Date().toISOString();
    const sellerTxHash = sellerMessage.recipientTransactionHash;
    const feeTxHash = feeMessage.recipientTransactionHash;
    await db.batch([
      db
        .update(deals)
        .set({
          status: "awaiting_delivery",
          sellerTxHash,
          feeTxHash,
          verifiedAt,
          updatedAt: verifiedAt,
        })
        .where(eq(deals.id, deal.id)),
      db
        .update(ledgerEntries)
        .set({ status: "recorded", updatedAt: verifiedAt })
        .where(eq(ledgerEntries.dealId, deal.id)),
      db.insert(dealEvents).values({
        id: crypto.randomUUID(),
        dealId: deal.id,
        actorUserId: null,
        type: "onchain_payment_verified",
        fromStatus: "payment_submitted",
        toStatus: "awaiting_delivery",
        detail: JSON.stringify({
          sellerTxHash,
          feeTxHash,
          sellerMasterchainSeqno: sellerMessage.masterchainSeqno,
          feeMasterchainSeqno: feeMessage.masterchainSeqno,
        }),
        createdAt: verifiedAt,
      }),
    ]);
    confirmed += 1;
  }

  return { checked: pending.length, confirmed };
}
