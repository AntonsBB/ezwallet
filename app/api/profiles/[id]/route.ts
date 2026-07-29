import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  listings,
  users,
  verificationAttestations,
} from "@/db/schema";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";
import { anonymousRequestKey } from "@/lib/session-security";
import { verificationSummary } from "@/lib/verification";

export const dynamic = "force-dynamic";

const profileIdSchema = z.coerce.number().int().positive();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await enforceRateLimit(
      "public-profile",
      await anonymousRequestKey(request),
      90,
      300
    );
    const parsedId = profileIdSchema.safeParse((await context.params).id);
    if (!parsedId.success) {
      return noStoreJson({ error: "Profile was not found." }, { status: 404 });
    }
    const db = getDb();
    const [profile] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        photoUrl: users.photoUrl,
        bio: users.bio,
        walletVerifiedAt: users.walletVerifiedAt,
        walletNetwork: users.walletNetwork,
        ratingMilli: users.ratingMilli,
        reviewCount: users.reviewCount,
        dealsCompleted: users.dealsCompleted,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          eq(users.id, parsedId.data),
          eq(users.moderationStatus, "active")
        )
      )
      .limit(1);
    if (!profile) {
      return noStoreJson({ error: "Profile was not found." }, { status: 404 });
    }

    const [attestations, activeListings] = await Promise.all([
      db
        .select({
          kind: verificationAttestations.kind,
          status: verificationAttestations.status,
          assuranceLevel: verificationAttestations.assuranceLevel,
          verifiedAt: verificationAttestations.verifiedAt,
          expiresAt: verificationAttestations.expiresAt,
        })
        .from(verificationAttestations)
        .where(eq(verificationAttestations.userId, profile.id)),
      db
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
        })
        .from(listings)
        .where(
          and(
            eq(listings.ownerId, profile.id),
            eq(listings.status, "active"),
            eq(listings.moderationStatus, "approved")
          )
        )
        .orderBy(desc(listings.createdAt))
        .limit(24),
    ]);
    const verification = verificationSummary(
      Boolean(profile.walletVerifiedAt),
      attestations
    );

    return noStoreJson({
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        photoUrl: profile.photoUrl,
        bio: profile.bio,
        walletVerified: Boolean(profile.walletVerifiedAt),
        verificationLevel: verification.level,
        verificationLabel: verification.label,
        ratingMilli: profile.ratingMilli,
        reviewCount: profile.reviewCount,
        dealsCompleted: profile.dealsCompleted,
        memberSince: profile.createdAt.slice(0, 7),
      },
      listings: activeListings.map((listing) => ({
        ...listing,
        ownerId: profile.id,
        ownerName: profile.displayName,
        ownerUsername: null,
        ownerPhotoUrl: profile.photoUrl,
        ownerRatingMilli: profile.ratingMilli,
        ownerReviewCount: profile.reviewCount,
        ownerDealsCompleted: profile.dealsCompleted,
        ownerWalletVerified: Boolean(profile.walletVerifiedAt),
        ownerWalletNetwork: profile.walletNetwork,
      })),
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return noStoreJson(
      { error: "This storefront is temporarily unavailable." },
      { status: 500 }
    );
  }
}
