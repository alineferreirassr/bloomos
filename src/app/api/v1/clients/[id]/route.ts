import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { toApiClient } from "@/core/api/mappers";
import { getClientById } from "@/lib/data";
import { NotFoundError } from "@/core/errors";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 4 — `GET /api/v1/clients/:id`. `crm.read` scope. */
export const GET = createApiHandler<{ id: string }>("crm.read", async (_request, _auth, { id }): Promise<NextResponse> => {
  try {
    const client = await getClientById(id);
    return apiSuccess(toApiClient(client));
  } catch (error) {
    if (error instanceof NotFoundError) throw new ApiError("not_found", `No client with id "${id}" was found.`);
    throw error;
  }
});
