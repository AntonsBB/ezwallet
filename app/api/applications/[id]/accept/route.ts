import { and, eq, inArray } from "drizzle-orm";
import { getBinding, getDb } from "@/db";
import {
  applications,
  dealEvents,
  deals,
  ledgerEntries,
  listings,
  users,
} from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import { calculateTransactionFees } from "@/lib/format";
import {
  inspectPaymentConfiguration,
  normalizeTonAddress,
} from "@/lib/payment-configuration";
import { paymentReadinessMessage } from "@/lib/payment-readiness";
import {
  buildNativeTonEscrow,
  DEFAULT_DELIVERY_WINDOW_SECONDS,
} from "@/lib/ton-escrow";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

function isActiveDealConflict(error: unknown) {
  const message =
    error instanceof Error
      ? `${error.message} ${String(error.cause ?? "")}`
      : String(error);
  return (
    message.includes("deals_listing_active_idx") ||
    message.includes("UNIQUE constraint failed: deals.listing_id")
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const buyer = await authenticateRequest(request);
    await enforceRateLimit("application-accept", buyer.id, 20, 86400);
    const { id } = await context.params;
    const db = getDb();
    const [application] = await db
      .select({
        id: applications.id,
        status: applications.status,
        listingId: listings.id,
        listingTitle: listings.title,
        listingOwnerId: listings.ownerId,
        listingStatus: listings.status,
        listingType: listings.type,
        applicantId: applications.applicantId,
        offerNano: applications.offerNano,
        sellerWalletAddress: users.walletAddress,
        sellerWalletNetwork: users.walletNetwork,
        sellerWalletVerifiedAt: users.walletVerifiedAt,
      })
      .from(applications)
      .innerJoin(listings, eq(listings.id, applications.listingId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .where(eq(applications.id, id))
      .limit(1);
    if (
      !application ||
      application.listingOwnerId !== buyer.id ||
      application.listingType !== "job" ||
      application.listingStatus !== "active" ||
      application.status !== "sent"
    ) {
      return noStoreJson({ error: "Application not found." }, { status: 404 });
    }
    if (!buyer.walletAddress || !buyer.walletVerifiedAt || !buyer.walletNetwork) {
      return noStoreJson(
        { error: "Verify your TON wallet before hiring." },
        { status: 409 }
      );
    }
    if (
      !application.sellerWalletAddress ||
      !application.sellerWalletVerifiedAt ||
      !application.sellerWalletNetwork
    ) {
      return noStoreJson(
        { error: "The applicant must verify a payout wallet first." },
        { status: 409 }
      );
    }

    const network =
      getBinding("TON_NETWORK") === "mainnet" ? "mainnet" : "testnet";
    const testnet = network === "testnet";
    if (
      buyer.walletNetwork !== network ||
      application.sellerWalletNetwork !== network
    ) {
      return noStoreJson(
        { error: `Both profiles must verify a ${network} wallet.` },
        { status: 409 }
      );
    }
    const paymentConfiguration = inspectPaymentConfiguration({
      network,
      platformFeeAddress: getBinding("PLATFORM_FEE_ADDRESS"),
      arbitratorAddress: getBinding("ESCROW_ARBITRATOR_ADDRESS"),
      arbitratorTelegramId: getBinding("ESCROW_ARBITRATOR_TELEGRAM_ID"),
    });
    if (!paymentConfiguration.ready) {
      return noStoreJson(
        {
          error: paymentReadinessMessage(
            paymentConfiguration.blockers,
            network
          ),
        },
        { status: 503 }
      );
    }

    const buyerWalletAddress = normalizeTonAddress(
      buyer.walletAddress,
      network
    );
    const sellerWalletAddress = normalizeTonAddress(
      application.sellerWalletAddress,
      network
    );
    const platformWalletAddress = paymentConfiguration.platformWalletAddress;
    const arbitratorWalletAddress =
      paymentConfiguration.arbitratorWalletAddress;
    const [existing] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(
        and(
          eq(deals.listingId, application.listingId),
          inArray(deals.status, [
            "pending_wallet",
            "payment_submitted",
            "awaiting_delivery",
            "disputed",
          ])
        )
      )
      .limit(1);
    if (existing) {
      return noStoreJson(
        { error: "This job already has an active deal." },
        { status: 409 }
      );
    }

    const baseNano = BigInt(application.offerNano);
    const {
      buyerFeeNano,
      sellerFeeNano,
      buyerTotalNano,
      platformFeeNano,
      sellerAmountNano,
    } = calculateTransactionFees(baseNano);
    const dealId = crypto.randomUUID();
    const now = new Date().toISOString();
    const deliveryDeadlineUnix =
      Math.floor(Date.now() / 1000) + DEFAULT_DELIVERY_WINDOW_SECONDS;
    const escrow = buildNativeTonEscrow({
      dealId,
      buyerAddress: buyerWalletAddress,
      sellerAddress: sellerWalletAddress,
      arbitratorAddress: arbitratorWalletAddress,
      platformAddress: platformWalletAddress,
      baseAmountNano: baseNano,
      buyerFeeNano,
      sellerFeeNano,
      buyerTotalNano,
      sellerAmountNano,
      platformFeeNano,
      deliveryDeadlineUnix,
      network,
    });
    await db.batch([
      db.insert(deals).values({
        id: dealId,
        listingId: application.listingId,
        applicationId: application.id,
        buyerId: buyer.id,
        sellerId: application.applicantId,
        buyerWalletAddress,
        sellerWalletAddress,
        platformWalletAddress,
        arbitratorWalletAddress,
        asset: "TON",
        grossNano: baseNano.toString(),
        buyerFeeNano: buyerFeeNano.toString(),
        sellerFeeNano: sellerFeeNano.toString(),
        buyerTotalNano: buyerTotalNano.toString(),
        platformFeeNano: platformFeeNano.toString(),
        sellerAmountNano: sellerAmountNano.toString(),
        feeBps: 100,
        network,
        escrowAddress: escrow.address,
        escrowCodeHash: escrow.codeHash,
        escrowDataHash: escrow.dataHash,
        escrowFundingAmountNano: escrow.fundingAmountNano.toString(),
        escrowStatus: "awaiting_funding",
        deliveryDeadlineUnix: escrow.deliveryDeadlineUnix,
        reviewWindowSeconds: escrow.reviewWindowSeconds,
        status: "pending_wallet",
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(ledgerEntries).values([
        {
          id: crypto.randomUUID(),
          dealId,
          accountUserId: buyer.id,
          kind: "buyer_payment",
          amountNano: `-${buyerTotalNano}`,
          status: "created",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          dealId,
          accountUserId: application.applicantId,
          kind: "seller_proceeds",
          amountNano: sellerAmountNano.toString(),
          status: "created",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          dealId,
          accountUserId: null,
          kind: "platform_fee",
          amountNano: platformFeeNano.toString(),
          status: "created",
          createdAt: now,
          updatedAt: now,
        },
      ]),
      db
        .update(applications)
        .set({ status: "accepted" })
        .where(and(eq(applications.id, id), eq(applications.status, "sent"))),
      db.insert(dealEvents).values({
        id: crypto.randomUUID(),
        dealId,
        actorUserId: buyer.id,
        type: "application_accepted",
        toStatus: "pending_wallet",
        detail: JSON.stringify({
          applicationId: id,
          feeBps: 100,
          buyerFeeNano: buyerFeeNano.toString(),
          sellerFeeNano: sellerFeeNano.toString(),
          escrowAddress: escrow.address,
          asset: "TON",
        }),
        createdAt: now,
      }),
    ]);

    return noStoreJson(
      {
        deal: {
          id: dealId,
          title: application.listingTitle,
          grossNano: baseNano.toString(),
          buyerFeeNano: buyerFeeNano.toString(),
          sellerFeeNano: sellerFeeNano.toString(),
          buyerTotalNano: buyerTotalNano.toString(),
          platformFeeNano: platformFeeNano.toString(),
          sellerAmountNano: sellerAmountNano.toString(),
          asset: "TON",
          escrowAddress: escrow.address,
          escrowFundingAmountNano: escrow.fundingAmountNano.toString(),
          deliveryDeadlineUnix: escrow.deliveryDeadlineUnix,
          reviewWindowSeconds: escrow.reviewWindowSeconds,
        },
        transaction: {
          validUntil: Math.floor(Date.now() / 1000) + 300,
          network: testnet ? "-3" : "-239",
          from: buyerWalletAddress,
          messages: [
            {
              address: escrow.address,
              amount: escrow.fundingAmountNano.toString(),
              stateInit: escrow.stateInit,
              payload: escrow.fundingPayload,
            },
          ],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (isActiveDealConflict(error)) {
      return noStoreJson(
        { error: "This job already has an active deal." },
        { status: 409 }
      );
    }
    return authErrorResponse(error);
  }
}
