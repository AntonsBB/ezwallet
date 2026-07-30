type EscrowStatus =
  | "legacy"
  | "awaiting_funding"
  | "funded"
  | "delivered"
  | "disputed"
  | "released"
  | "refunded";

export function mayViewDeliveryAddress(input: {
  actorUserId: number;
  buyerId: number;
  sellerId: number;
  escrowStatus: EscrowStatus;
}) {
  if (input.actorUserId === input.buyerId) return true;
  if (input.actorUserId !== input.sellerId) return false;
  return ["funded", "delivered", "disputed", "released"].includes(
    input.escrowStatus
  );
}

export function mayAddShippingTracking(input: {
  actorUserId: number;
  sellerId: number;
  dealStatus: string;
  escrowStatus: EscrowStatus;
  mode: string;
}) {
  return (
    input.actorUserId === input.sellerId &&
    input.dealStatus === "awaiting_delivery" &&
    input.escrowStatus === "funded" &&
    input.mode === "shipping"
  );
}

export function shippingTrackingRequiredBeforeDelivery(input: {
  mode: string | null | undefined;
  trackingCode: string | null | undefined;
}) {
  return input.mode == null || (input.mode === "shipping" && !input.trackingCode);
}
