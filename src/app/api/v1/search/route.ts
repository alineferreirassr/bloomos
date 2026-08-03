import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { apiErrorResponse } from "@/core/api/response";
import { toApiClient, toApiEvent } from "@/core/api/mappers";
import { getClients, getEvents } from "@/lib/data";

export const dynamic = "force-dynamic";

const SEARCH_RESULT_LIMIT_PER_TYPE = 20;

/**
 * Checkpoint 16, Step 4 — `GET /api/v1/search?q=`. `crm.read` scope.
 * Composes `getClients({search})`/`getEvents({search})` — their own
 * existing `search` filter fields already do the real matching (never a
 * new search algorithm here). No cross-entity CRM search existed before
 * this checkpoint; Proposals has no `search` filter field at all (its own
 * repository takes no free-text query), so it's not part of this
 * endpoint — narrowing to Clients + Events only, honestly, rather than
 * fabricating a Proposal search that doesn't exist internally either.
 */
export const GET = createApiHandler("crm.read", async (request): Promise<NextResponse> => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) return apiErrorResponse("invalid_request", "Provide a search query via ?q=.");

  const [clients, events] = await Promise.all([getClients({ search: query }), getEvents({ search: query })]);

  return apiSuccess({
    clients: clients.slice(0, SEARCH_RESULT_LIMIT_PER_TYPE).map(toApiClient),
    events: events.slice(0, SEARCH_RESULT_LIMIT_PER_TYPE).map(toApiEvent),
  });
});
