import { z } from "zod";
import { getDb } from "@/db";
import { reports } from "@/db/schema";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

const reportSchema = z
  .object({
    listingId: z.string().uuid().or(z.string().max(80)).optional(),
    reportedUserId: z.number().int().positive().optional(),
    dealId: z.string().uuid().optional(),
    reason: z.enum([
      "prohibited_item",
      "fraud",
      "harassment",
      "identity",
      "payment",
      "other",
    ]),
    detail: z.string().trim().min(10).max(1000),
  })
  .refine(
    (value) => value.listingId || value.reportedUserId || value.dealId,
    "Choose what you are reporting."
  );

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("report-create", user.id, 8, 86400);
    const payload = reportSchema.parse(await request.json());
    const report = {
      id: crypto.randomUUID(),
      reporterId: user.id,
      ...payload,
    };
    await getDb().insert(reports).values(report);
    return noStoreJson({ report: { id: report.id, status: "open" } }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { error: error.issues[0]?.message ?? "Report is invalid." },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}
