import { getBinding } from "@/db";
import { constantTimeTextEqual, noStoreJson } from "@/lib/security";
import { reconcilePendingDeals } from "@/lib/ton-payment";

export async function POST(request: Request) {
  const configuredSecret = getBinding("RECONCILE_SECRET");
  const providedSecret = request.headers.get("authorization")?.replace(
    /^Bearer\s+/i,
    ""
  );
  if (
    !configuredSecret ||
    !providedSecret ||
    !(await constantTimeTextEqual(providedSecret, configuredSecret))
  ) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }
  return noStoreJson(await reconcilePendingDeals());
}
