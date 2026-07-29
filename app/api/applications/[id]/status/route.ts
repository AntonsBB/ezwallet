import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { applications, listings } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const schema = z.object({ status: z.enum(["declined", "withdrawn"]) });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("application-status", user.id, 50, 3600);
    const payload = schema.parse(await request.json());
    const { id } = await context.params;
    const db = getDb();
    const [application] = await db
      .select({
        id: applications.id,
        applicantId: applications.applicantId,
        ownerId: listings.ownerId,
        status: applications.status,
      })
      .from(applications)
      .innerJoin(listings, eq(listings.id, applications.listingId))
      .where(eq(applications.id, id))
      .limit(1);
    const authorized =
      application &&
      application.status === "sent" &&
      ((payload.status === "declined" && application.ownerId === user.id) ||
        (payload.status === "withdrawn" && application.applicantId === user.id));
    if (!authorized) {
      return noStoreJson({ error: "Application not found." }, { status: 404 });
    }
    await db
      .update(applications)
      .set({ status: payload.status })
      .where(and(eq(applications.id, id), eq(applications.status, "sent")));
    return noStoreJson({ application: { id, status: payload.status } });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson({ error: "Application action is invalid." }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
