import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getBinding, getDb } from "@/db";
import {
  applications,
  dealChainActions,
  dealEvents,
  deals,
  ledgerEntries,
  listings,
  users,
} from "@/db/schema";
import { buildEscrowFundingPayload } from "@/lib/ton-escrow";
import {
  lookupFinalizedContractMessage,
  sameHash,
  terminalPayoutsMatch,
} from "@/lib/ton-verification";

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
  return lookupFinalizedContractMessage({
    ...input,
    baseUrl: providerBase(input.network),
    headers: providerHeaders(),
  });
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
      dealUpdate.completionCountedAt =
        sql`COALESCE(${deals.completionCountedAt}, ${confirmedAt})`;
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
    ];
    if (isRelease) {
      const completionNotCounted = sql`EXISTS (
        SELECT 1
        FROM "deals"
        WHERE "id" = ${deal.id}
          AND "completion_counted_at" IS NULL
      )`;
      batch.push(
        db
          .update(users)
          .set({ dealsCompleted: sql`${users.dealsCompleted} + 1` })
          .where(and(eq(users.id, deal.buyerId), completionNotCounted)),
        db
          .update(users)
          .set({ dealsCompleted: sql`${users.dealsCompleted} + 1` })
          .where(and(eq(users.id, deal.sellerId), completionNotCounted))
      );
    }
    batch.push(
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
        .onConflictDoNothing()
    );
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
