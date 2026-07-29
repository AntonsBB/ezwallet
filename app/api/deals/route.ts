import { Address, beginCell } from "@ton/core";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getBinding, getDb } from "@/db";
import {
  dealEvents,
  deals,
  ledgerEntries,
  listings,
  users,
} from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import { splitPlatformFee } from "@/lib/format";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const createDealSchema = z.object({
  listingId: z.string().min(1).max(80),
});

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
  return Address.parse(value).toString({
    bounceable: false,
    testOnly: testnet,
  });
}

export async function POST(request: Request) {
  try {
    const buyer = await authenticateRequest(request);
    await enforceRateLimit("deal-create", buyer.id, 12, 3600);
    const payload = createDealSchema.parse(await request.json());
    const db = getDb();
    const [listing] = await db
      .select({
        id: listings.id,
        ownerId: listings.ownerId,
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
          eq(listings.status, "active")
        )
      )
      .limit(1);

    if (!listing) {
      return Response.json({ error: "Listing not found." }, { status: 404 });
    }
    if (listing.ownerId === buyer.id) {
      return Response.json(
        { error: "You cannot buy your own listing." },
        { status: 400 }
      );
    }
    if (!buyer.walletAddress || !buyer.walletVerifiedAt || !buyer.walletNetwork) {
      return Response.json(
        { error: "Verify your connected TON wallet before starting a deal." },
        { status: 409 }
      );
    }
    if (
      !listing.sellerWalletAddress ||
      !listing.sellerWalletVerifiedAt ||
      !listing.sellerWalletNetwork
    ) {
      return Response.json(
        { error: "The seller needs to verify a payout wallet first." },
        { status: 409 }
      );
    }

    const url = new URL(request.url);
    const localPreview = ["localhost", "127.0.0.1", "terminal.local"].includes(
      url.hostname
    );
    const network =
      getBinding("TON_NETWORK") === "mainnet" ? "mainnet" : "testnet";
    if (buyer.walletNetwork !== network) {
      return Response.json(
        { error: `Connect and verify a ${network} wallet.` },
        { status: 409 }
      );
    }
    if (listing.sellerWalletNetwork !== network) {
      return Response.json(
        { error: `The seller must verify a ${network} payout wallet.` },
        { status: 409 }
      );
    }
    const testnet = network === "testnet";
    const configuredFeeAddress = getBinding("PLATFORM_FEE_ADDRESS");
    const feeAddress =
      configuredFeeAddress ?? (localPreview ? LOCAL_TESTNET_FEE_ADDRESS : null);

    if (!feeAddress) {
      return Response.json(
        {
          error:
            "Payments are paused until the platform fee wallet is configured.",
        },
        { status: 503 }
      );
    }

    let buyerWalletAddress: string;
    let sellerWalletAddress: string;
    let platformWalletAddress: string;
    try {
      buyerWalletAddress = normalizeAddress(
        buyer.walletAddress,
        testnet
      );
      sellerWalletAddress = normalizeAddress(
        listing.sellerWalletAddress,
        testnet
      );
      platformWalletAddress = normalizeAddress(feeAddress, testnet);
    } catch {
      return Response.json(
        { error: "One of the TON wallet addresses is invalid." },
        { status: 400 }
      );
    }

    const grossNano = BigInt(listing.priceNano);
    const { platformFeeNano, sellerAmountNano } =
      splitPlatformFee(grossNano);
    const dealId = crypto.randomUUID();
    const now = new Date().toISOString();
    const [existing] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(
        and(
          eq(deals.listingId, listing.id),
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
      return Response.json(
        { error: "You already have an active deal for this listing." },
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
        grossNano: grossNano.toString(),
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
          amountNano: `-${grossNano}`,
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
        detail: JSON.stringify({ listingId: listing.id, feeBps: 100 }),
        createdAt: now,
      }),
    ]);

    return Response.json(
      {
        deal: {
          id: dealId,
          listingId: listing.id,
          title: listing.title,
          grossNano: grossNano.toString(),
          platformFeeNano: platformFeeNano.toString(),
          sellerAmountNano: sellerAmountNano.toString(),
          feeBps: 100,
          network,
          status: "pending_wallet",
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
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message ?? "Deal is invalid." },
        { status: 400 }
      );
    }
    if (
      error instanceof Error &&
      (error.message.includes("Telegram") ||
        error.message.includes("preview user"))
    ) {
      return authErrorResponse(error);
    }
    console.error(
      JSON.stringify({
        message: "deal_create_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return Response.json(
      { error: "The deal could not be created." },
      { status: 500 }
    );
  }
}
