import { distanceMeters } from "@/lib/geo";

export type PublicPoint = {
  latitudeE6: number;
  longitudeE6: number;
};

export type LocatedListing = {
  id: string;
  latitudeE6: number | null;
  longitudeE6: number | null;
};

export function listingPoint(listing: LocatedListing): PublicPoint | null {
  if (listing.latitudeE6 === null || listing.longitudeE6 === null) return null;
  return {
    latitudeE6: listing.latitudeE6,
    longitudeE6: listing.longitudeE6,
  };
}

export function approximateDistance(
  listing: LocatedListing,
  from: PublicPoint | null
) {
  const point = listingPoint(listing);
  if (!from || !point) return null;
  return distanceMeters(from, point);
}

export function sortListingsByDistance<T extends LocatedListing>(
  listings: T[],
  from: PublicPoint | null
) {
  if (!from) return listings;
  return listings
    .map((listing, index) => ({
      listing,
      index,
      distance: approximateDistance(listing, from),
    }))
    .sort((left, right) => {
      if (left.distance === null && right.distance === null) {
        return left.index - right.index;
      }
      if (left.distance === null) return 1;
      if (right.distance === null) return -1;
      return left.distance - right.distance || left.index - right.index;
    })
    .map(({ listing }) => listing);
}

export function formatApproximateDistance(distance: number | null) {
  if (distance === null) return null;
  if (distance < 1_000) {
    return `about ${Math.max(100, Math.round(distance / 100) * 100)} m away`;
  }
  const kilometres = distance / 1_000;
  return `about ${kilometres < 10 ? kilometres.toFixed(1) : Math.round(kilometres)} km away`;
}
