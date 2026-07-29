import { z } from "zod";
import { tonToNano } from "./format";
import { normalizePublicCoordinates } from "./geo";
import { marketCategoryOptions } from "./listing-categories";

const listingMediaKeySchema = z
  .string()
  .regex(/^listing-media\/\d+\/[a-f0-9-]+\.(jpg|png|webp)$/i);

const listingFieldsSchema = z.object({
  section: z.enum(["market", "work"]),
  type: z.enum(["physical", "digital", "service", "job"]),
  title: z.string().trim().min(5).max(90),
  description: z.string().trim().min(20).max(800),
  category: z.string().trim().min(2).max(64),
  priceTon: z.string().trim(),
  location: z.string().trim().min(2).max(80),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationRadiusMeters: z.number().int().min(250).max(100_000).optional(),
  delivery: z.string().trim().min(2).max(80),
  mediaKey: listingMediaKeySchema.optional(),
});

function addListingRelationshipIssues(
  value: z.infer<typeof listingFieldsSchema>,
  context: z.RefinementCtx
) {
  const typeMatchesSection =
    (value.section === "market" &&
      (value.type === "physical" || value.type === "digital")) ||
    (value.section === "work" &&
      (value.type === "service" || value.type === "job"));
  if (!typeMatchesSection) {
    context.addIssue({
      code: "custom",
      path: ["type"],
      message: "Listing type does not match its section.",
    });
  }

  if (
    value.section === "market" &&
    !marketCategoryOptions.includes(
      value.category as (typeof marketCategoryOptions)[number]
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["category"],
      message: "Choose a supported marketplace category.",
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
}

export const listingCreateSchema = listingFieldsSchema.superRefine(
  addListingRelationshipIssues
);

export const listingEditSchema = listingFieldsSchema
  .extend({
    expectedUpdatedAt: z.string().min(1).max(40),
  })
  .superRefine(addListingRelationshipIssues);

export type ListingInput = z.infer<typeof listingCreateSchema>;
export type ListingEditInput = z.infer<typeof listingEditSchema>;

export class ListingInputError extends Error {}

export function prepareListingFields(payload: ListingInput) {
  let priceNano: string;
  try {
    priceNano = tonToNano(payload.priceTon);
  } catch {
    throw new ListingInputError("Choose a valid TON price.");
  }
  if (BigInt(priceNano) < 1_000_000n) {
    throw new ListingInputError("The minimum listing price is 0.001 TON.");
  }

  const publicLocation = normalizePublicCoordinates({
    latitude: payload.latitude,
    longitude: payload.longitude,
    radiusMeters: payload.locationRadiusMeters,
  });

  return {
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
  } as const;
}

export function mediaKeyBelongsToUser(
  mediaKey: string | undefined,
  userId: number
) {
  return !mediaKey || mediaKey.startsWith(`listing-media/${userId}/`);
}
