import { getMediaBucket } from "@/db";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("media-upload", user.id, 20, 86400);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (!contentLength || contentLength > 5_250_000) {
      return noStoreJson(
        { error: "Image must be no larger than 5 MB." },
        { status: 413 }
      );
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return noStoreJson({ error: "Choose an image." }, { status: 400 });
    }
    const extension = allowedTypes.get(file.type);
    if (!extension || file.size > 5_000_000) {
      return noStoreJson(
        { error: "Use a JPG, PNG, or WebP image up to 5 MB." },
        { status: 415 }
      );
    }
    const key = `listing-media/${user.id}/${crypto.randomUUID()}.${extension}`;
    await getMediaBucket().put(key, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=86400" },
      customMetadata: { ownerId: String(user.id) },
    });
    return noStoreJson({ key, url: `/api/media/${key}` }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return authErrorResponse(error);
  }
}
