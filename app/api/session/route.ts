import { desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { deals, listings, users } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);
    const db = getDb();
    const buyerUser = alias(users, "buyer_user");
    const sellerUser = alias(users, "seller_user");
    const recentDeals = await db
      .select({
        id: deals.id,
        listingId: deals.listingId,
        title: listings.title,
        imageUrl: listings.imageUrl,
        grossNano: deals.grossNano,
        buyerFeeNano: deals.buyerFeeNano,
        sellerFeeNano: deals.sellerFeeNano,
        buyerTotalNano: deals.buyerTotalNano,
        platformFeeNano: deals.platformFeeNano,
        sellerAmountNano: deals.sellerAmountNano,
        asset: deals.asset,
        escrowAddress: deals.escrowAddress,
        escrowStatus: deals.escrowStatus,
        escrowFundingAmountNano: deals.escrowFundingAmountNano,
        deliveryDeadlineUnix: deals.deliveryDeadlineUnix,
        reviewWindowSeconds: deals.reviewWindowSeconds,
        reviewDeadlineUnix: deals.reviewDeadlineUnix,
        status: deals.status,
        network: deals.network,
        transactionRef: deals.transactionRef,
        buyerId: deals.buyerId,
        sellerId: deals.sellerId,
        buyerName: buyerUser.displayName,
        sellerName: sellerUser.displayName,
        createdAt: deals.createdAt,
      })
      .from(deals)
      .innerJoin(listings, eq(deals.listingId, listings.id))
      .innerJoin(buyerUser, eq(buyerUser.id, deals.buyerId))
      .innerJoin(sellerUser, eq(sellerUser.id, deals.sellerId))
      .where(or(eq(deals.buyerId, user.id), eq(deals.sellerId, user.id)))
      .orderBy(desc(deals.createdAt))
      .limit(20);

    return Response.json({
      user,
      deals: recentDeals.slice(0, 10).map((deal) => ({
        ...deal,
        counterpartyName:
          deal.buyerId === user.id ? deal.sellerName : deal.buyerName,
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
