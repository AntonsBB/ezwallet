import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { listings } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import { tonToNano } from "@/lib/format";
import { normalizePublicCoordinates } from "@/lib/geo";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const listingSchema = z
  .object({
    section: z.enum(["market", "work"]),
    type: z.enum(["physical", "digital", "service", "job"]),
    title: z.string().trim().min(5).max(90),
    description: z.string().trim().min(20).max(800),
    category: z.string().trim().min(2).max(40),
    priceTon: z.string().trim(),
    location: z.string().trim().min(2).max(80),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    locationRadiusMeters: z.number().int().min(250).max(100_000).optional(),
    delivery: z.string().trim().min(2).max(80),
    mediaKey: z
      .string()
      .regex(/^listing-media\/\d+\/[a-f0-9-]+\.(jpg|png|webp)$/i)
      .optional(),
  })
  .superRefine((value, context) => {
    const valid =
      (value.section === "market" &&
        ["physical", "digital"].includes(value.type)) ||
      (value.section === "work" && ["service", "job"].includes(value.type));
    if (!valid) {
      context.addIssue({
        code: "custom",
        path: ["type"],
        message: "Listing type does not match its section.",
      });
    }
    if (
      (value.latitude === undefined) !==
      (value.longitude === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude and longitude must be provided together.",
      });
    }
  });

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("listing-create", user.id, 20, 86400);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 16_384) {
      return noStoreJson(
        { error: "Listing is too large." },
        { status: 413 }
      );
    }
    const payload = listingSchema.parse(await request.json());
    const priceNano = tonToNano(payload.priceTon);
    const publicLocation = normalizePublicCoordinates({
      latitude: payload.latitude,
      longitude: payload.longitude,
      radiusMeters: payload.locationRadiusMeters,
    });
    if (BigInt(priceNano) < 1_000_000n) {
      return noStoreJson(
        { error: "The minimum listing price is 0.001 TON." },
        { status: 400 }
      );
    }
    if (
      payload.mediaKey &&
      !payload.mediaKey.startsWith(`listing-media/${user.id}/`)
    ) {
      return noStoreJson(
        { error: "That listing image does not belong to your profile." },
        { status: 403 }
      );
    }

    const listing = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      section: payload.section,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      priceNano,
      location: payload.location,
      latitudeE6: publicLocation?.latitudeE6 ?? null,
      longitudeE6: publicLocation?.longitudeE6 ?? null,
      locationRadiusMeters: publicLocation?.radiusMeters ?? null,
      delivery: payload.delivery,
      imageUrl: payload.mediaKey ? `/api/media/${payload.mediaKey}` : null,
      mediaKey: payload.mediaKey ?? null,
    } as const;

    await getDb().insert(listings).values(listing);
    return noStoreJson({ listing }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: error.issues[0]?.message ?? "Listing is invalid." },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);
    const rows = await getDb()
      .select()
      .from(listings)
      .where(eq(listings.ownerId, user.id))
      .orderBy(desc(listings.createdAt));
    return noStoreJson({ listings: rows });
  } catch (error) {
    return authErrorResponse(error);
  }
}
