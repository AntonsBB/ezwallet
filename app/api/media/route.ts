import { getMediaStore } from "@/db";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import { inspectImageUpload } from "@/lib/image-upload";
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
    const image = await file.arrayBuffer();
    if (!inspectImageUpload(image, file.type)) {
      return noStoreJson(
        { error: "The image content or dimensions are not supported." },
        { status: 415 }
      );
    }
    const key = `listing-media/${user.id}/${crypto.randomUUID()}.${extension}`;
    await getMediaStore().put(key, image, {
      metadata: {
        contentType: file.type,
        ownerId: String(user.id),
      },
    });
    return noStoreJson({ key, url: `/api/media/${key}` }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return authErrorResponse(error);
  }
}
