export type AccountIdentityBindingDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "identity_owned_by_another_profile"
        | "profile_bound_to_another_identity"
        | "profile_identity_revoked";
    };

export function evaluateAccountIdentityBinding(input: {
  targetUserId?: number;
  subject: string;
  subjectOwnerUserId?: number;
  profileIdentity?: {
    subject: string;
    revokedAt: string | null;
  };
}): AccountIdentityBindingDecision {
  if (!input.targetUserId) return { allowed: true };
  if (
    input.subjectOwnerUserId &&
    input.subjectOwnerUserId !== input.targetUserId
  ) {
    return {
      allowed: false,
      reason: "identity_owned_by_another_profile",
    };
  }
  if (input.profileIdentity?.revokedAt) {
    return { allowed: false, reason: "profile_identity_revoked" };
  }
  if (
    input.profileIdentity &&
    input.profileIdentity.subject !== input.subject
  ) {
    return {
      allowed: false,
      reason: "profile_bound_to_another_identity",
    };
  }
  return { allowed: true };
}
