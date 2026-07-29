import { getMediaBucket } from "@/db";

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await context.params;
  const key = segments.join("/");
  if (
    !/^listing-media\/\d+\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(key)
  ) {
    return new Response("Not found.", { status: 404 });
  }
  const object = await getMediaBucket().get(key);
  if (!object) return new Response("Not found.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", "public, max-age=86400");
  return new Response(object.body, { headers });
}
