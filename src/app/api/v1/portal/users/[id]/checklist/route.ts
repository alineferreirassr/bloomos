import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { ApiError } from "@/core/api/errors";
import { NotFoundError } from "@/core/errors";
import { getClientPortalChecklistForAccount } from "@/lib/data/clientPortal/clientPortalChecklistService";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 9 — `GET /api/v1/portal/users/:id/checklist`. `portal.read` scope. Reuses `getClientPortalChecklistForAccount()`, this checkpoint's own explicit-account sibling of the session-bound `getClientPortalChecklist()`. */
export const GET = createApiHandler<{ id: string }>("portal.read", async (_request, auth, { id }): Promise<NextResponse> => {
  try {
    const items = await getClientPortalChecklistForAccount(auth.workspaceId, id);
    return apiSuccess(items);
  } catch (error) {
    if (error instanceof NotFoundError) throw new ApiError("not_found", error.message);
    throw error;
  }
});
