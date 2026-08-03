import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { getProposalsRepository } from "@/lib/data/proposals";

export const dynamic = "force-dynamic";

const RECENT_PROPOSALS_LIMIT = 10000;

/** Checkpoint 16, Step 4 — `GET /api/v1/proposals`. `crm.read` scope. Reuses `getRecentProposals()` (the same source the Bloom AI landing page's own Recent Activity/Usage Statistics reads) rather than a new query. `?event_id=` narrows to one Event via `getProposalsByEvent`. */
export const GET = createApiHandler("crm.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("event_id");

  const proposals = eventId
    ? await getProposalsRepository().getProposalsByEvent(eventId)
    : await getProposalsRepository().getRecentProposals(auth.workspaceId, RECENT_PROPOSALS_LIMIT);

  const sorted = [...proposals].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { items, meta } = paginate(sorted, parsePagination(url));
  return apiSuccess(items, meta);
});
