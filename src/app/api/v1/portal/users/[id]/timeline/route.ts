import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { ApiError } from "@/core/api/errors";
import { NotFoundError } from "@/core/errors";
import { getClientPortalTimelineForAccount } from "@/lib/data/clientPortal/mockRepository";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 9 — `GET /api/v1/portal/users/:id/timeline`. `portal.read` scope. Reuses `getClientPortalTimelineForAccount()` (this checkpoint's own explicit-account sibling of the session-bound `getClientPortalTimeline()`). Mock-only this phase — see `mockRepository.ts`'s own doc comments for why the Client Portal domain has no Supabase implementation of its per-account variants yet. */
export const GET = createApiHandler<{ id: string }>("portal.read", async (_request, auth, { id }): Promise<NextResponse> => {
  try {
    const entries = await getClientPortalTimelineForAccount(auth.workspaceId, id);
    return apiSuccess(entries);
  } catch (error) {
    if (error instanceof NotFoundError) throw new ApiError("not_found", error.message);
    throw error;
  }
});
