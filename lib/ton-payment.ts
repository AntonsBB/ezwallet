import { Address, Cell } from "@ton/core";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getBinding, getDb } from "@/db";
import {
  applications,
  dealChainActions,
  dealEvents,
  deals,
  ledgerEntries,
  listings,
} from "@/db/schema";
import {
  buildEscrowFundingPayload,
  dealIdToUint256,
  queryIdForDeal,
} from "@/lib/ton-escrow";

class TonProviderUnavailableError extends Error {}

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
    hash?: string;
  };
};

type TonAccountState = {
  account_status?: string;
  code_hash?: string;
  data_hash?: string;
};

type TonTransaction = {
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

function sameAddress(left: string | undefined, right: string) {
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

function sameBody(value: string | undefined, expectedBase64: string) {
  return cellHash(value) === cellHash(expectedBase64);
}

function normalizedHash(value: string | undefined) {
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

function sameHash(value: string | undefined, expectedHex: string) {
  return normalizedHash(value) === expectedHex.toLowerCase();
}

function hashesEqual(left: string | undefined, right: string | undefined) {
  const normalizedLeft = normalizedHash(left);
  return normalizedLeft !== null && normalizedLeft === normalizedHash(right);
}

function providerBase(network: "mainnet" | "testnet") {
  return network === "mainnet"
    ? "https://toncenter.com/api/v3"
    : "https://testnet.toncenter.com/api/v3";
}

function providerHeaders() {
  const headers = new Headers();
  const apiKey = getBinding("TONCENTER_API_KEY");
  if (apiKey) headers.set("x-api-key", apiKey);
  return headers;
}

async function findFinalizedContractMessage(input: {
  source: string;
  destination: string;
  amountNano: string;
  payloadBase64: string;
  expectedCodeHash: string;
  expectedDataHash?: string;
  startUnix: number;
  network: "mainnet" | "testnet";
  phase: "deploy" | "action";
}) {
  const base = providerBase(input.network);
  const query = new URLSearchParams({
    source: Address.parse(input.source).toRawString(),
    destination: Address.parse(input.destination).toRawString(),
    start_utime: String(Math.max(0, input.startUnix - 60)),
    exclude_externals: "true",
    limit: "30",
    sort: "desc",
  });
  const headers = providerHeaders();
  const response = await fetch(`${base}/messages?${query}`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
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

  const transactionResponse = await fetch(
    `${base}/transactions?${new URLSearchParams({
      hash: message.in_msg_tx_hash,
      limit: "1",
    })}`,
    { headers, signal: AbortSignal.timeout(10_000) }
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

function terminalPayoutsMatch(
  transaction: TonTransaction,
  deal: typeof deals.$inferSelect,
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

async function reconcileFunding(limit: number) {
  const db = getDb();
  const pending = await db
    .select()
    .from(deals)
    .where(
      and(
        inArray(deals.status, ["pending_wallet", "payment_submitted"]),
        eq(deals.escrowStatus, "awaiting_funding")
      )
    )
    .orderBy(asc(deals.submittedAt))
    .limit(Math.min(limit, 100));
  let confirmed = 0;
  let expired = 0;

  for (const deal of pending) {
    if (
      !deal.escrowAddress ||
      !deal.escrowCodeHash ||
      !deal.escrowDataHash ||
      !deal.escrowFundingAmountNano
    ) {
      continue;
    }
    let result;
    try {
      result = await findFinalizedContractMessage({
        source: deal.buyerWalletAddress,
        destination: deal.escrowAddress,
        amountNano: deal.escrowFundingAmountNano,
        payloadBase64: buildEscrowFundingPayload(deal.id),
        expectedCodeHash: deal.escrowCodeHash,
        expectedDataHash: deal.escrowDataHash,
        startUnix: Math.floor(
          Date.parse(deal.submittedAt ?? deal.createdAt) / 1000
        ),
        network: deal.network,
        phase: "deploy",
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          message: "ton_provider_funding_check_unavailable",
          error: error instanceof Error ? error.message : String(error),
        })
      );
      break;
    }
    if (!result) {
      const referenceTime = Date.parse(deal.submittedAt ?? deal.createdAt);
      const timeoutMs =
        deal.status === "payment_submitted"
          ? 24 * 60 * 60 * 1000
          : 30 * 60 * 1000;
      if (
        !Number.isFinite(referenceTime) ||
        Date.now() - referenceTime < timeoutMs
      ) {
        continue;
      }
      const expiredAt = new Date().toISOString();
      const expirationBatch = [
        db
          .update(deals)
          .set({
            status: "cancelled" as const,
            updatedAt: expiredAt,
            completedAt: expiredAt,
          })
          .where(
            and(
              eq(deals.id, deal.id),
              eq(deals.status, deal.status),
              eq(deals.escrowStatus, "awaiting_funding")
            )
          ),
        db
          .update(ledgerEntries)
          .set({ status: "void" as const, updatedAt: expiredAt })
          .where(eq(ledgerEntries.dealId, deal.id)),
        db
          .insert(dealEvents)
          .values({
            id: `escrow-funding-expired:${deal.id}`,
            dealId: deal.id,
            actorUserId: null,
            type: "escrow_funding_expired",
            fromStatus: deal.status,
            toStatus: "cancelled",
            detail: JSON.stringify({
              reason: "No matching finalized funding transaction was found.",
            }),
            createdAt: expiredAt,
          })
          .onConflictDoNothing(),
      ];
      if (deal.applicationId) {
        expirationBatch.push(
          db
            .update(applications)
            .set({ status: "sent" as const })
            .where(
              and(
                eq(applications.id, deal.applicationId),
                eq(applications.status, "accepted")
              )
            )
        );
      }
      await db.batch(expirationBatch);
      expired += 1;
      continue;
    }

    const verifiedAt = new Date().toISOString();
    const escrowFundingTxHash = result.transaction.hash!;
    await db.batch([
      db
        .update(deals)
        .set({
          status: "awaiting_delivery",
          escrowStatus: "funded",
          escrowFundingTxHash,
          verifiedAt,
          updatedAt: verifiedAt,
        })
        .where(
          and(
            eq(deals.id, deal.id),
            inArray(deals.status, ["pending_wallet", "payment_submitted"]),
            eq(deals.escrowStatus, "awaiting_funding")
          )
        ),
      db
        .update(ledgerEntries)
        .set({ status: "recorded", updatedAt: verifiedAt })
        .where(
          and(
            eq(ledgerEntries.dealId, deal.id),
            eq(ledgerEntries.kind, "buyer_payment")
          )
        ),
      db
        .insert(dealEvents)
        .values({
          id: `escrow-funded:${deal.id}`,
          dealId: deal.id,
          actorUserId: null,
          type: "escrow_funding_verified",
          fromStatus: deal.status,
          toStatus: "awaiting_delivery",
          detail: JSON.stringify({
            escrowAddress: deal.escrowAddress,
            escrowFundingTxHash,
            masterchainSeqno: result.transaction.mc_block_seqno,
          }),
          createdAt: verifiedAt,
        })
        .onConflictDoNothing(),
    ]);
    confirmed += 1;
  }
  return { checked: pending.length, confirmed, expired };
}

async function reconcileActions(limit: number) {
  const db = getDb();
  const pending = await db
    .select()
    .from(dealChainActions)
    .where(inArray(dealChainActions.status, ["prepared", "submitted"]))
    .orderBy(asc(dealChainActions.submittedAt))
    .limit(Math.min(limit, 100));
  let confirmed = 0;

  for (const action of pending) {
    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.id, action.dealId))
      .limit(1);
    if (!deal?.escrowAddress || !deal.escrowCodeHash) continue;

    let result;
    try {
      result = await findFinalizedContractMessage({
        source: action.actorWalletAddress,
        destination: deal.escrowAddress,
        amountNano: action.messageValueNano,
        payloadBase64: action.payloadBase64,
        expectedCodeHash: deal.escrowCodeHash,
        startUnix: Math.floor(
          Date.parse(action.submittedAt ?? action.createdAt) / 1000
        ),
        network: deal.network,
        phase: "action",
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          message: "ton_provider_action_check_unavailable",
          error: error instanceof Error ? error.message : String(error),
        })
      );
      break;
    }
    if (!result) {
      const createdAt = Date.parse(action.createdAt);
      if (
        Number.isFinite(createdAt) &&
        Date.now() - createdAt >= 30 * 60 * 1000
      ) {
        const expiredAt = new Date().toISOString();
        await db
          .update(dealChainActions)
          .set({ status: "expired", updatedAt: expiredAt })
          .where(
            and(
              eq(dealChainActions.id, action.id),
              inArray(dealChainActions.status, ["prepared", "submitted"])
            )
          );
      }
      continue;
    }

    const releaseKinds = [
      "confirm_received",
      "release_after_review",
      "resolve_release",
    ] as const;
    const refundKinds = ["refund_expired", "resolve_refund"] as const;
    const isRelease = releaseKinds.includes(
      action.kind as (typeof releaseKinds)[number]
    );
    const isRefund = refundKinds.includes(
      action.kind as (typeof refundKinds)[number]
    );
    const isTerminal = isRelease || isRefund;
    if (
      (isRelease &&
        !terminalPayoutsMatch(result.transaction, deal, "release")) ||
      (isRefund && !terminalPayoutsMatch(result.transaction, deal, "refund"))
    ) {
      continue;
    }
    if (
      !isTerminal &&
      (result.transaction.description?.destroyed === true ||
        result.transaction.account_state_after?.account_status !== "active" ||
        !sameHash(
          result.transaction.account_state_after?.code_hash,
          deal.escrowCodeHash
        ))
    ) {
      continue;
    }

    const confirmedAt = new Date().toISOString();
    const txHash = result.transaction.hash!;
    const dealUpdate: Partial<typeof deals.$inferInsert> = {
      updatedAt: confirmedAt,
    };
    if (action.kind === "mark_delivered") {
      dealUpdate.escrowStatus = "delivered";
      dealUpdate.reviewDeadlineUnix =
        (result.transaction.now ?? Math.floor(Date.now() / 1000)) +
        (deal.reviewWindowSeconds ?? 0);
    } else if (action.kind === "open_dispute") {
      dealUpdate.escrowStatus = "disputed";
      dealUpdate.status = "disputed";
    } else if (isRelease) {
      dealUpdate.escrowStatus = "released";
      dealUpdate.status = "fulfilled";
      dealUpdate.escrowSettlementTxHash = txHash;
      dealUpdate.completedAt = confirmedAt;
    } else if (isRefund) {
      dealUpdate.escrowStatus = "refunded";
      dealUpdate.status = "cancelled";
      dealUpdate.escrowSettlementTxHash = txHash;
      dealUpdate.completedAt = confirmedAt;
    }

    const batch = [
      db
        .update(dealChainActions)
        .set({
          status: "confirmed" as const,
          txHash,
          confirmedAt,
          updatedAt: confirmedAt,
        })
        .where(
          and(
            eq(dealChainActions.id, action.id),
            inArray(dealChainActions.status, ["prepared", "submitted"])
          )
        ),
      db.update(deals).set(dealUpdate).where(eq(deals.id, deal.id)),
      db
        .insert(dealEvents)
        .values({
          id: `chain-action:${action.id}`,
          dealId: deal.id,
          actorUserId: action.actorUserId,
          type: `chain_${action.kind}_verified`,
          fromStatus: deal.status,
          toStatus: dealUpdate.status ?? deal.status,
          detail: JSON.stringify({
            actionId: action.id,
            txHash,
            masterchainSeqno: result.transaction.mc_block_seqno,
          }),
          createdAt: confirmedAt,
        })
        .onConflictDoNothing(),
    ];
    if (isRelease) {
      batch.push(
        db
          .update(ledgerEntries)
          .set({ status: "recorded", updatedAt: confirmedAt })
          .where(
            and(
              eq(ledgerEntries.dealId, deal.id),
              inArray(ledgerEntries.kind, ["seller_proceeds", "platform_fee"])
            )
          ),
        db
          .update(listings)
          .set({ status: "sold", updatedAt: confirmedAt })
          .where(eq(listings.id, deal.listingId))
      );
    } else if (isRefund) {
      batch.push(
        db
          .update(ledgerEntries)
          .set({ status: "void", updatedAt: confirmedAt })
          .where(eq(ledgerEntries.dealId, deal.id))
      );
    }
    await db.batch(batch);
    confirmed += 1;
  }
  return { checked: pending.length, confirmed };
}

export async function reconcilePendingDeals(limit = 40) {
  const [funding, actions] = await Promise.all([
    reconcileFunding(limit),
    reconcileActions(limit),
  ]);
  return {
    checked: funding.checked + actions.checked,
    confirmed: funding.confirmed + actions.confirmed,
    funding,
    actions,
  };
}
