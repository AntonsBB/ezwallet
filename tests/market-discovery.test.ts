import assert from "node:assert/strict";
import test from "node:test";
import {
  activeMarketFilterCount,
  defaultMarketFilterForm,
  filterAndSortMarketListings,
  parseMarketPriceRange,
} from "../lib/market-discovery";

const listings = [
  {
    id: "physical-home",
    section: "market",
    type: "physical",
    title: "Oak desk",
    description: "Solid wood desk",
    category: "Home",
    priceNano: "5000000000",
    location: "Riga",
    delivery: "Pickup",
    createdAt: "2026-07-29T10:00:00.000Z",
  },
  {
    id: "digital-design",
    section: "market",
    type: "digital",
    title: "Design files",
    description: "Editable interface kit",
    category: "Design resources",
    priceNano: "2000000000",
    location: "Remote",
    delivery: "Download",
    createdAt: "2026-07-29T12:00:00.000Z",
  },
  {
    id: "work-row",
    section: "work",
    type: "service",
    title: "Furniture assembly",
    description: "Local service",
    category: "Home",
    priceNano: "1000000000",
    location: "Riga",
    delivery: "Tomorrow",
    createdAt: "2026-07-29T13:00:00.000Z",
  },
] as const;

test("filters real market rows by type, price, query, and saved state", () => {
  const result = filterAndSortMarketListings(listings, {
    query: "design",
    category: "Other",
    savedOnly: true,
    savedListingIds: new Set(["digital-design"]),
    filters: {
      type: "digital",
      minPriceTon: "1",
      maxPriceTon: "3",
      sort: "newest",
    },
  });
  assert.deepEqual(
    result.map((listing) => listing.id),
    ["digital-design"]
  );
});

test("keeps legacy free-form categories discoverable under Other", () => {
  const result = filterAndSortMarketListings(listings, {
    query: "",
    category: "Other",
    savedOnly: false,
    savedListingIds: new Set(),
    filters: defaultMarketFilterForm,
  });
  assert.deepEqual(
    result.map((listing) => listing.id),
    ["digital-design"]
  );
});

test("sorts by exact nanotons without floating-point conversion", () => {
  const lowToHigh = filterAndSortMarketListings(listings, {
    query: "",
    category: "All",
    savedOnly: false,
    savedListingIds: new Set(),
    filters: { ...defaultMarketFilterForm, sort: "price_low" },
  });
  assert.deepEqual(
    lowToHigh.map((listing) => listing.id),
    ["digital-design", "physical-home"]
  );

  const highToLow = filterAndSortMarketListings(listings, {
    query: "",
    category: "All",
    savedOnly: false,
    savedListingIds: new Set(),
    filters: { ...defaultMarketFilterForm, sort: "price_high" },
  });
  assert.deepEqual(
    highToLow.map((listing) => listing.id),
    ["physical-home", "digital-design"]
  );
});

test("rejects invalid ranges and counts only advanced filters", () => {
  assert.throws(
    () =>
      parseMarketPriceRange({
        type: "all",
        minPriceTon: "4",
        maxPriceTon: "3",
        sort: "newest",
      }),
    /Minimum price/
  );
  assert.equal(
    activeMarketFilterCount({
      type: "physical",
      minPriceTon: "1",
      maxPriceTon: "",
      sort: "price_low",
    }),
    3
  );
});
