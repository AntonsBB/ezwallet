export const listingLifecycleActions = ["pause", "activate", "close"] as const;

export type ListingLifecycleAction =
  (typeof listingLifecycleActions)[number];

export type ListingStatus =
  | "draft"
  | "active"
  | "paused"
  | "sold"
  | "closed"
  | "removed";

export function nextListingStatus(
  current: ListingStatus,
  action: ListingLifecycleAction
): ListingStatus | null {
  if (current === "active" && action === "pause") return "paused";
  if (current === "paused" && action === "activate") return "active";
  if (
    (current === "active" || current === "paused") &&
    action === "close"
  ) {
    return "closed";
  }
  return null;
}
