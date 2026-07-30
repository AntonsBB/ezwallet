import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { verificationAttestations } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import { noStoreJson } from "@/lib/security";
import { verificationSummary } from "@/lib/verification";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);
    const attestations = await getDb()
      .select({
        kind: verificationAttestations.kind,
        status: verificationAttestations.status,
        assuranceLevel: verificationAttestations.assuranceLevel,
        verifiedAt: verificationAttestations.verifiedAt,
        expiresAt: verificationAttestations.expiresAt,
      })
      .from(verificationAttestations)
      .where(eq(verificationAttestations.userId, user.id));
    const summary = verificationSummary(
      Boolean(user.walletVerifiedAt),
      attestations
    );

    return noStoreJson({
      summary,
      checks: attestations.map((attestation) => ({
        kind: attestation.kind,
        status: attestation.status,
        assuranceLevel: attestation.assuranceLevel,
        verifiedAt: attestation.verifiedAt,
        expiresAt: attestation.expiresAt,
      })),
      onboarding: {
        available: false,
        reason:
          "A regulated identity-verification provider has not been configured.",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
