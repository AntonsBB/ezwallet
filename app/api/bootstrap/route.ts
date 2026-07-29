import { desc, eq } from "drizzle-orm";
import { getBinding, getDb } from "@/db";
import { listings, users } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: listings.id,
        section: listings.section,
        type: listings.type,
        title: listings.title,
        description: listings.description,
        category: listings.category,
        priceNano: listings.priceNano,
        currency: listings.currency,
        imageUrl: listings.imageUrl,
        location: listings.location,
        latitudeE6: listings.latitudeE6,
        longitudeE6: listings.longitudeE6,
        locationRadiusMeters: listings.locationRadiusMeters,
        delivery: listings.delivery,
        status: listings.status,
        createdAt: listings.createdAt,
        ownerId: users.id,
        ownerName: users.displayName,
        ownerUsername: users.username,
        ownerPhotoUrl: users.photoUrl,
        ownerRatingMilli: users.ratingMilli,
        ownerReviewCount: users.reviewCount,
        ownerDealsCompleted: users.dealsCompleted,
        ownerWalletVerifiedAt: users.walletVerifiedAt,
        ownerWalletNetwork: users.walletNetwork,
      })
      .from(listings)
      .innerJoin(users, eq(listings.ownerId, users.id))
      .where(eq(listings.status, "active"))
      .orderBy(desc(listings.createdAt));

    const hasFeeAddress = Boolean(getBinding("PLATFORM_FEE_ADDRESS"));
    const hasArbitratorAddress = Boolean(
      getBinding("ESCROW_ARBITRATOR_ADDRESS")
    );

    const publicListings = rows.map(
      ({ ownerWalletVerifiedAt, ...listing }) => ({
        ...listing,
        ownerWalletVerified: Boolean(ownerWalletVerifiedAt),
      })
    );

    return Response.json({
      listings: publicListings,
      config: {
        feeBps: 100,
        network:
          getBinding("TON_NETWORK") === "mainnet" ? "mainnet" : "testnet",
        paymentsReady: hasFeeAddress && hasArbitratorAddress,
        telegramReady: Boolean(getBinding("TELEGRAM_BOT_TOKEN")),
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "bootstrap_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return Response.json(
      { error: "Marketplace data is temporarily unavailable." },
      { status: 500 }
    );
  }
}
