import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { toApiEvent } from "@/core/api/mappers";
import { getEventById } from "@/lib/data";
import { NotFoundError } from "@/core/errors";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 4 — `GET /api/v1/events/:id`. `crm.read` scope. */
export const GET = createApiHandler<{ id: string }>("crm.read", async (_request, _auth, { id }): Promise<NextResponse> => {
  try {
    const event = await getEventById(id);
    return apiSuccess(toApiEvent(event));
  } catch (error) {
    if (error instanceof NotFoundError) throw new ApiError("not_found", `No event with id "${id}" was found.`);
    throw error;
  }
});
