import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getProposalsRepository } from "@/lib/data/proposals";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 4 — `GET /api/v1/proposals/:id`. `crm.read` scope. `getProposalById` returns `null` rather than throwing — normalized to a 404 here, the same as every other detail endpoint. */
export const GET = createApiHandler<{ id: string }>("crm.read", async (_request, _auth, { id }): Promise<NextResponse> => {
  const proposal = await getProposalsRepository().getProposalById(id);
  if (!proposal) throw new ApiError("not_found", `No proposal with id "${id}" was found.`);
  return apiSuccess(proposal);
});
