import { getMediaStore } from "@/db";

type MediaMetadata = {
  contentType?: string;
  ownerId?: string;
};

const allowedContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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
  const object = await getMediaStore().getWithMetadata<MediaMetadata>(
    key,
    "arrayBuffer"
  );
  if (!object.value) return new Response("Not found.", { status: 404 });
  const headers = new Headers();
  const contentType = object.metadata?.contentType;
  headers.set(
    "content-type",
    contentType && allowedContentTypes.has(contentType)
      ? contentType
      : "application/octet-stream"
  );
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.value, { headers });
}
