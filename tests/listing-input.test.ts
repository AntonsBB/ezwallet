import assert from "node:assert/strict";
import test from "node:test";
import {
  ListingInputError,
  listingCreateSchema,
  listingEditSchema,
  mediaKeyBelongsToUser,
  prepareListingFields,
} from "../lib/listing-input";

const validMarketListing = {
  section: "market",
  type: "physical",
  title: "Restored oak side table",
  description: "Solid oak side table with measured dimensions and light wear.",
  category: "Home",
  priceTon: "1.250000001",
  location: "Riga centre",
  delivery: "Pickup by arrangement",
} as const;

test("accepts normalized Market categories and exact TON prices", () => {
  const parsed = listingCreateSchema.parse(validMarketListing);
  const prepared = prepareListingFields(parsed);
  assert.equal(prepared.priceNano, "1250000001");
  assert.equal(prepared.category, "Home");
  assert.equal(prepared.latitudeE6, null);
});

test("rejects unsupported Market categories and mismatched listing types", () => {
  const unsupportedCategory = listingCreateSchema.safeParse({
    ...validMarketListing,
    category: "Furniture deals",
  });
  assert.equal(unsupportedCategory.success, false);

  const mismatchedType = listingCreateSchema.safeParse({
    ...validMarketListing,
    type: "service",
  });
  assert.equal(mismatchedType.success, false);
});

test("keeps work categories flexible while requiring coordinate pairs", () => {
  const validWork = listingCreateSchema.safeParse({
    ...validMarketListing,
    section: "work",
    type: "service",
    category: "Bicycle repair",
    latitude: 56.9496,
    longitude: 24.1052,
    locationRadiusMeters: 1_000,
  });
  assert.equal(validWork.success, true);

  const partialLocation = listingCreateSchema.safeParse({
    ...validMarketListing,
    section: "work",
    type: "service",
    category: "Bicycle repair",
    latitude: 56.9496,
  });
  assert.equal(partialLocation.success, false);
});

test("requires an edit version and rejects unsafe prices", () => {
  assert.equal(
    listingEditSchema.safeParse({
      ...validMarketListing,
      expectedUpdatedAt: "2026-07-29T18:00:00.000Z",
    }).success,
    true
  );
  assert.equal(listingEditSchema.safeParse(validMarketListing).success, false);

  assert.throws(
    () =>
      prepareListingFields(
        listingCreateSchema.parse({
          ...validMarketListing,
          priceTon: "0.0009",
        })
      ),
    ListingInputError
  );
});

test("accepts only media keys scoped to the authenticated owner", () => {
  assert.equal(
    mediaKeyBelongsToUser(
      "listing-media/42/7a2e93f6-e0a4-48bc-8120-a409b3057abe.jpg",
      42
    ),
    true
  );
  assert.equal(
    mediaKeyBelongsToUser(
      "listing-media/7/7a2e93f6-e0a4-48bc-8120-a409b3057abe.jpg",
      42
    ),
    false
  );
});
