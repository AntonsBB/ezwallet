import { tonToNano } from "./format";

export const marketCategoryOptions = [
  "Electronics",
  "Mobility",
  "Vehicles",
  "Home",
  "Fashion",
  "Digital",
  "Other",
] as const;

export const marketListingTypes = ["all", "physical", "digital"] as const;
export type MarketListingType = (typeof marketListingTypes)[number];

export const marketSortOrders = [
  "newest",
  "price_low",
  "price_high",
] as const;
export type MarketSortOrder = (typeof marketSortOrders)[number];

export type MarketFilterForm = {
  type: MarketListingType;
  minPriceTon: string;
  maxPriceTon: string;
  sort: MarketSortOrder;
};

export const defaultMarketFilterForm: MarketFilterForm = {
  type: "all",
  minPriceTon: "",
  maxPriceTon: "",
  sort: "newest",
};

type MarketListing = {
  id: string;
  section: string;
  type: string;
  title: string;
  description: string;
  category: string;
  priceNano: string;
  location: string;
  delivery: string;
  createdAt: string;
};

export type MarketDiscoveryOptions = {
  query: string;
  category: string;
  savedOnly: boolean;
  savedListingIds: ReadonlySet<string>;
  filters: MarketFilterForm;
};

export function parseMarketPriceRange(filters: MarketFilterForm) {
  const minPriceNano = filters.minPriceTon.trim()
    ? tonToNano(filters.minPriceTon)
    : null;
  const maxPriceNano = filters.maxPriceTon.trim()
    ? tonToNano(filters.maxPriceTon)
    : null;

  if (
    minPriceNano !== null &&
    maxPriceNano !== null &&
    BigInt(minPriceNano) > BigInt(maxPriceNano)
  ) {
    throw new Error("Minimum price cannot exceed maximum price.");
  }

  return { minPriceNano, maxPriceNano };
}

export function activeMarketFilterCount(filters: MarketFilterForm) {
  return [
    filters.type !== "all",
    Boolean(filters.minPriceTon.trim()),
    Boolean(filters.maxPriceTon.trim()),
    filters.sort !== "newest",
  ].filter(Boolean).length;
}

function categoryMatches(listingCategory: string, selectedCategory: string) {
  if (selectedCategory === "All") return true;
  const normalizedListingCategory = listingCategory.trim().toLowerCase();
  const normalizedSelectedCategory = selectedCategory.toLowerCase();
  if (selectedCategory !== "Other") {
    return normalizedListingCategory === normalizedSelectedCategory;
  }
  const knownCategories = new Set(
    marketCategoryOptions
      .filter((category) => category !== "Other")
      .map((category) => category.toLowerCase())
  );
  return (
    normalizedListingCategory === "other" ||
    !knownCategories.has(normalizedListingCategory)
  );
}

export function filterAndSortMarketListings<T extends MarketListing>(
  listings: readonly T[],
  options: MarketDiscoveryOptions
) {
  const normalizedQuery = options.query.toLowerCase().trim();
  const { minPriceNano, maxPriceNano } = parseMarketPriceRange(options.filters);

  return listings
    .filter((listing) => {
      if (listing.section !== "market") return false;
      const queryMatches =
        !normalizedQuery ||
        [
          listing.title,
          listing.description,
          listing.category,
          listing.location,
          listing.delivery,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const typeMatches =
        options.filters.type === "all" ||
        listing.type === options.filters.type;
      const price = BigInt(listing.priceNano);
      const minimumMatches =
        minPriceNano === null || price >= BigInt(minPriceNano);
      const maximumMatches =
        maxPriceNano === null || price <= BigInt(maxPriceNano);
      const savedMatches =
        !options.savedOnly || options.savedListingIds.has(listing.id);
      return (
        queryMatches &&
        categoryMatches(listing.category, options.category) &&
        typeMatches &&
        minimumMatches &&
        maximumMatches &&
        savedMatches
      );
    })
    .sort((left, right) => {
      if (options.filters.sort === "price_low") {
        const difference = BigInt(left.priceNano) - BigInt(right.priceNano);
        if (difference !== 0n) return difference < 0n ? -1 : 1;
      }
      if (options.filters.sort === "price_high") {
        const difference = BigInt(right.priceNano) - BigInt(left.priceNano);
        if (difference !== 0n) return difference < 0n ? -1 : 1;
      }
      const createdDifference = right.createdAt.localeCompare(left.createdAt);
      return createdDifference || left.id.localeCompare(right.id);
    });
}
