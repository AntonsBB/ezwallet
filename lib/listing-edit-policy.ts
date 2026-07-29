type ListingEditState = {
  section: string;
  type: string;
  status: string;
  updatedAt: string;
  hasActiveDeal: boolean;
  hasOpenApplication: boolean;
};

type ListingEditRequest = {
  section: string;
  type: string;
  expectedUpdatedAt: string;
};

export function listingEditConflict(
  listing: ListingEditState,
  request: ListingEditRequest
) {
  if (listing.status !== "active" && listing.status !== "paused") {
    return "Only live or paused listings can be edited.";
  }
  if (
    request.section !== listing.section ||
    request.type !== listing.type
  ) {
    return "A listing's section and type cannot be changed.";
  }
  if (request.expectedUpdatedAt !== listing.updatedAt) {
    return "The listing changed. Refresh it before editing.";
  }
  if (listing.hasActiveDeal) {
    return "A listing with an active deal cannot be edited. Existing deal terms stay unchanged.";
  }
  if (listing.hasOpenApplication) {
    return "A listing with an open application cannot be edited. Resolve the application first.";
  }
  return null;
}
