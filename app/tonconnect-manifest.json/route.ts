export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      url: origin,
      name: "EzWallet",
      iconUrl: `${origin}/brand/icon-180.png`,
      termsOfUseUrl: `${origin}/terms`,
      privacyPolicyUrl: `${origin}/privacy`,
    },
    {
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=300",
      },
    }
  );
}
