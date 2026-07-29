import { canonicalAppOrigin } from "@/lib/app-url";

export function GET(request: Request) {
  const origin = canonicalAppOrigin(request.url);
  return Response.json(
    {
      url: origin,
      name: "Easy Wallet",
      iconUrl: `${origin}/brand/icon-180.png`,
      termsOfUseUrl: `${origin}/terms`,
      privacyPolicyUrl: `${origin}/privacy`,
    },
    {
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
        "content-type": "application/json; charset=utf-8",
      },
    }
  );
}
