import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(320),
  city: z.string().trim().min(1).max(80),
});

export async function PATCH(request: Request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("profile-update", user.id, 10, 3600);
    const payload = profileSchema.parse(await request.json());
    const updatedAt = new Date().toISOString();
    await getDb()
      .update(users)
      .set({ ...payload, updatedAt })
      .where(eq(users.id, user.id));
    return noStoreJson({ user: { ...user, ...payload, updatedAt } });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: error.issues[0]?.message ?? "Profile is invalid." },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}
