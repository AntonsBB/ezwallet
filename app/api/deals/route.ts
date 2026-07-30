import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getBinding, getDb } from "@/db";
import {
  dealFulfillments,
  dealEvents,
  deals,
  ledgerEntries,
  listings,
  users,
} from "@/db/schema";
import {
  authenticateRequest,
  AuthenticationError,
  authErrorResponse,
} from "@/lib/auth";
import {
  deliveryAddressSchema,
  encryptDeliveryAddress,
} from "@/lib/deal-fulfillment";
import { calculateTransactionFees } from "@/lib/format";
import {
  inspectPaymentConfiguration,
  normalizeTonAddress,
} from "@/lib/payment-configuration";
import { paymentReadinessMessage } from "@/lib/payment-readiness";
import {
  readBoundedTextBody,
  RequestBodyTooLargeError,
} from "@/lib/request-body";
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

const createDealSchema = z.object({
  listingId: z.string().min(1).max(80),
  deliveryAddress: deliveryAddressSchema.optional(),
});

function isActiveDealConflict(error: unknown) {
  const message =
    error instanceof Error
      ? `${error.message} ${String(error.cause ?? "")}`
      : String(error);
  return (
    message.includes("deals_listing_active_idx") ||
    message.includes("UNIQUE constraint failed: deals.listing_id") ||
    message.includes("deal_listing_not_eligible")
  );
}

export async function POST(request: Request) {
  try {
    const buyer = await authenticateRequest(request);
    await enforceRateLimit("deal-create", buyer.id, 12, 3600);
    const rawBody = await readBoundedTextBody(request, 16_384);
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return noStoreJson({ error: "Deal request is invalid." }, { status: 400 });
    }
    const payload = createDealSchema.parse(json);
    const db = getDb();
    const [listing] = await db
      .select({
        id: listings.id,
        ownerId: listings.ownerId,
        type: listings.type,
        fulfillmentMode: listings.fulfillmentMode,
        title: listings.title,
        priceNano: listings.priceNano,
        status: listings.status,
        sellerWalletAddress: users.walletAddress,
        sellerWalletNetwork: users.walletNetwork,
        sellerWalletVerifiedAt: users.walletVerifiedAt,
      })
      .from(listings)
      .innerJoin(users, eq(listings.ownerId, users.id))
      .where(
        and(
          eq(listings.id, payload.listingId),
          eq(listings.status, "active"),
          eq(listings.moderationStatus, "approved"),
          inArray(listings.type, ["physical", "digital", "service"]),
          eq(users.moderationStatus, "active")
        )
      )
      .limit(1);

    if (!listing) {
      return noStoreJson({ error: "Listing not found." }, { status: 404 });
    }
    if (listing.ownerId === buyer.id) {
      return noStoreJson(
        { error: "You cannot buy your own listing." },
        { status: 400 }
      );
    }
    if (buyer.moderationStatus !== "active") {
      return noStoreJson(
        { error: "This profile cannot start new deals right now." },
        { status: 403 }
      );
    }
    if (!buyer.walletAddress || !buyer.walletVerifiedAt || !buyer.walletNetwork) {
      return noStoreJson(
        { error: "Verify your connected TON wallet before starting a deal." },
        { status: 409 }
      );
    }
    if (
      !listing.sellerWalletAddress ||
      !listing.sellerWalletVerifiedAt ||
      !listing.sellerWalletNetwork
    ) {
      return noStoreJson(
        { error: "The seller needs to verify a payout wallet first." },
        { status: 409 }
      );
    }

    const network =
      getBinding("TON_NETWORK") === "mainnet" ? "mainnet" : "testnet";
    if (buyer.walletNetwork !== network) {
      return noStoreJson(
        { error: `Connect and verify a ${network} wallet.` },
        { status: 409 }
      );
    }
    if (listing.sellerWalletNetwork !== network) {
      return noStoreJson(
        { error: `The seller must verify a ${network} payout wallet.` },
        { status: 409 }
      );
    }
    const testnet = network === "testnet";
    const paymentConfiguration = inspectPaymentConfiguration({
      network,
      platformFeeAddress: getBinding("PLATFORM_FEE_ADDRESS"),
      arbitratorAddress: getBinding("ESCROW_ARBITRATOR_ADDRESS"),
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

    let buyerWalletAddress: string;
    let sellerWalletAddress: string;
    let platformWalletAddress: string;
    let arbitratorWalletAddress: string;
    try {
      buyerWalletAddress = normalizeTonAddress(buyer.walletAddress, network);
      sellerWalletAddress = normalizeTonAddress(
        listing.sellerWalletAddress,
        network
      );
      platformWalletAddress = paymentConfiguration.platformWalletAddress;
      arbitratorWalletAddress = paymentConfiguration.arbitratorWalletAddress;
    } catch {
      return noStoreJson(
        { error: "One of the TON wallet addresses is invalid." },
        { status: 400 }
      );
    }

    const baseNano = BigInt(listing.priceNano);
    const {
      buyerFeeNano,
      sellerFeeNano,
      buyerTotalNano,
      platformFeeNano,
      sellerAmountNano,
    } = calculateTransactionFees(baseNano);
    const dealId = crypto.randomUUID();
    const now = new Date().toISOString();
    let deliveryAddressCiphertext: string | null = null;
    if (listing.fulfillmentMode === "shipping") {
      if (!payload.deliveryAddress) {
        return noStoreJson(
          { error: "Add a delivery address for this shipped item." },
          { status: 400 }
        );
      }
      const encryptionKey = getBinding("DEAL_DATA_ENCRYPTION_KEY");
      if (!encryptionKey) {
        return noStoreJson(
          {
            error:
              "Private delivery details are temporarily unavailable. No payment was prepared.",
          },
          { status: 503 }
        );
      }
      deliveryAddressCiphertext = await encryptDeliveryAddress(
        payload.deliveryAddress,
        encryptionKey,
        dealId
      );
    } else if (payload.deliveryAddress) {
      return noStoreJson(
        { error: "This listing does not require a delivery address." },
        { status: 400 }
      );
    }
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
    const [existing] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(
        and(
          eq(deals.listingId, listing.id),
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
        { error: "This listing already has an active deal." },
        { status: 409 }
      );
    }

    await db.batch([
      db.insert(deals).values({
        id: dealId,
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: listing.ownerId,
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
      db.insert(dealFulfillments).values({
        dealId,
        mode: listing.fulfillmentMode,
        deliveryAddressCiphertext,
        deliveryAddressVersion:
          deliveryAddressCiphertext === null ? null : 1,
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
          accountUserId: listing.ownerId,
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
      db.insert(dealEvents).values({
        id: crypto.randomUUID(),
        dealId,
        actorUserId: buyer.id,
        type: "deal_created",
        toStatus: "pending_wallet",
        detail: JSON.stringify({
          listingId: listing.id,
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
          listingId: listing.id,
          title: listing.title,
          grossNano: baseNano.toString(),
          buyerFeeNano: buyerFeeNano.toString(),
          sellerFeeNano: sellerFeeNano.toString(),
          buyerTotalNano: buyerTotalNano.toString(),
          platformFeeNano: platformFeeNano.toString(),
          sellerAmountNano: sellerAmountNano.toString(),
          feeBps: 100,
          network,
          status: "pending_wallet",
          asset: "TON",
          escrowAddress: escrow.address,
          escrowFundingAmountNano: escrow.fundingAmountNano.toString(),
          deliveryDeadlineUnix: escrow.deliveryDeadlineUnix,
          reviewWindowSeconds: escrow.reviewWindowSeconds,
          fulfillmentMode: listing.fulfillmentMode,
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
    if (error instanceof RequestBodyTooLargeError) {
      return noStoreJson(
        { error: "Deal request is too large." },
        { status: 413 }
      );
    }
    if (isActiveDealConflict(error)) {
      return noStoreJson(
        { error: "This listing already has an active deal." },
        { status: 409 }
      );
    }
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: error.issues[0]?.message ?? "Deal is invalid." },
        { status: 400 }
      );
    }
    if (error instanceof AuthenticationError) {
      return authErrorResponse(error);
    }
    console.error(
      JSON.stringify({
        message: "deal_create_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return noStoreJson(
      { error: "The deal could not be created." },
      { status: 500 }
    );
  }
}
