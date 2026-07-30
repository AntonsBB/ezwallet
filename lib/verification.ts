export type VerificationKind =
  | "identity"
  | "address"
  | "business"
  | "sanctions_screen";

export type VerificationAttestation = {
  kind: VerificationKind;
  status:
    | "pending"
    | "verified"
    | "rejected"
    | "expired"
    | "revoked"
    | "needs_review";
  assuranceLevel: number;
  verifiedAt: string | null;
  expiresAt: string | null;
};

export type PublicVerificationLevel =
  | "unverified"
  | "wallet"
  | "identity"
  | "enhanced"
  | "business";

export function verificationSummary(
  walletVerified: boolean,
  attestations: VerificationAttestation[],
  now = new Date()
) {
  const activeKinds = new Set<VerificationKind>();
  let assuranceLevel = 0;

  for (const attestation of attestations) {
    if (
      attestation.status !== "verified" ||
      (attestation.expiresAt &&
        new Date(attestation.expiresAt).getTime() <= now.getTime())
    ) {
      continue;
    }
    activeKinds.add(attestation.kind);
    assuranceLevel = Math.max(
      assuranceLevel,
      Math.max(0, attestation.assuranceLevel)
    );
  }

  let level: PublicVerificationLevel = walletVerified
    ? "wallet"
    : "unverified";
  if (activeKinds.has("identity")) level = "identity";
  if (activeKinds.has("identity") && activeKinds.has("address")) {
    level = "enhanced";
  }
  if (activeKinds.has("business") && activeKinds.has("identity")) {
    level = "business";
  }

  const labels: Record<PublicVerificationLevel, string> = {
    unverified: "Not verified",
    wallet: "Wallet proof",
    identity: "Identity verified",
    enhanced: "Enhanced verified",
    business: "Business verified",
  };

  return {
    level,
    label: labels[level],
    assuranceLevel,
    activeKinds: [...activeKinds],
  };
}
