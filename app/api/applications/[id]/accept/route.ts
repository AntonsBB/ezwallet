import { Address, beginCell } from "@ton/core";
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
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const LOCAL_TESTNET_FEE_ADDRESS =
  "kQBERERERERERERERERERERERERERERERERERERERERERNHq";

function payloadFor(comment: string) {
  return beginCell()
    .storeUint(0, 32)
    .storeStringTail(comment)
    .endCell()
    .toBoc()
    .toString("base64");
}

function normalizeAddress(value: string, testnet: boolean) {
  return Address.parse(value).toString({ bounceable: false, testOnly: testnet });
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
    const localPreview = ["localhost", "127.0.0.1", "terminal.local"].includes(
      new URL(request.url).hostname
    );
    const feeAddress =
      getBinding("PLATFORM_FEE_ADDRESS") ??
      (localPreview ? LOCAL_TESTNET_FEE_ADDRESS : undefined);
    if (!feeAddress) {
      return noStoreJson(
        { error: "Payments are paused until the platform fee wallet is configured." },
        { status: 503 }
      );
    }

    const buyerWalletAddress = normalizeAddress(buyer.walletAddress, testnet);
    const sellerWalletAddress = normalizeAddress(
      application.sellerWalletAddress,
      testnet
    );
    const platformWalletAddress = normalizeAddress(feeAddress, testnet);
    const [existing] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(
        and(
          eq(deals.listingId, application.listingId),
          eq(deals.buyerId, buyer.id),
          inArray(deals.status, [
            "pending_wallet",
            "payment_submitted",
            "awaiting_delivery",
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
    await db.batch([
      db.insert(deals).values({
        id: dealId,
        listingId: application.listingId,
        buyerId: buyer.id,
        sellerId: application.applicantId,
        buyerWalletAddress,
        sellerWalletAddress,
        platformWalletAddress,
        grossNano: baseNano.toString(),
        buyerFeeNano: buyerFeeNano.toString(),
        sellerFeeNano: sellerFeeNano.toString(),
        buyerTotalNano: buyerTotalNano.toString(),
        platformFeeNano: platformFeeNano.toString(),
        sellerAmountNano: sellerAmountNano.toString(),
        feeBps: 100,
        network,
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
        },
        transaction: {
          validUntil: Math.floor(Date.now() / 1000) + 300,
          network: testnet ? "-3" : "-239",
          from: buyerWalletAddress,
          messages: [
            {
              address: sellerWalletAddress,
              amount: sellerAmountNano.toString(),
              payload: payloadFor(`EZW:${dealId}:SELLER`),
            },
            {
              address: platformWalletAddress,
              amount: platformFeeNano.toString(),
              payload: payloadFor(`EZW:${dealId}:FEE`),
            },
          ],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return authErrorResponse(error);
  }
}
