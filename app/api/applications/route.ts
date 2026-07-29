import { z } from "zod";
import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { applications, listings, users } from "@/db/schema";
import {
  authenticateRequest,
  AuthenticationError,
  authErrorResponse,
} from "@/lib/auth";
import { marketplaceAmountToNano } from "@/lib/format";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const applicationSchema = z.object({
  listingId: z.string().min(1).max(80),
  offerTon: z.string().trim(),
  message: z.string().trim().min(10).max(500),
});

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("application-create", user.id, 30, 86400);
    if (user.moderationStatus !== "active") {
      return noStoreJson(
        { error: "This profile cannot submit new applications right now." },
        { status: 403 }
      );
    }
    const payload = applicationSchema.parse(await request.json());
    const db = getDb();
    const [listing] = await db
      .select({
        id: listings.id,
        ownerId: listings.ownerId,
      })
      .from(listings)
      .innerJoin(users, eq(listings.ownerId, users.id))
      .where(
        and(
          eq(listings.id, payload.listingId),
          eq(listings.section, "work"),
          eq(listings.type, "job"),
          eq(listings.status, "active"),
          eq(listings.moderationStatus, "approved"),
          eq(users.moderationStatus, "active")
        )
      )
      .limit(1);

    if (!listing) {
      return Response.json({ error: "Work listing not found." }, { status: 404 });
    }
    if (listing.ownerId === user.id) {
      return Response.json(
        { error: "You cannot apply to your own listing." },
        { status: 400 }
      );
    }

    let offerNano: string;
    try {
      offerNano = marketplaceAmountToNano(payload.offerTon);
    } catch {
      return noStoreJson(
        { error: "Offer at least 0.001 TON." },
        { status: 400 }
      );
    }

    const application = {
      id: crypto.randomUUID(),
      listingId: listing.id,
      applicantId: user.id,
      offerNano,
      message: payload.message,
    };
    await db.insert(applications).values(application);
    return noStoreJson({ application }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: error.issues[0]?.message ?? "Application is invalid." },
        { status: 400 }
      );
    }
    if (error instanceof AuthenticationError) {
      return authErrorResponse(error);
    }
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      return noStoreJson(
        { error: "You already applied to this listing." },
        { status: 409 }
      );
    }
    return noStoreJson(
      { error: "The application could not be sent." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);
    const rows = await getDb()
      .select({
        id: applications.id,
        listingId: applications.listingId,
        listingTitle: listings.title,
        listingOwnerId: listings.ownerId,
        applicantId: applications.applicantId,
        applicantName: users.displayName,
        applicantPhotoUrl: users.photoUrl,
        offerNano: applications.offerNano,
        message: applications.message,
        status: applications.status,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .innerJoin(listings, eq(listings.id, applications.listingId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .where(
        or(
          eq(listings.ownerId, user.id),
          eq(applications.applicantId, user.id)
        )
      )
      .orderBy(desc(applications.createdAt))
      .limit(100);
    return noStoreJson({ applications: rows });
  } catch (error) {
    return authErrorResponse(error);
  }
}
