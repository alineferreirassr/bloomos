import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { parseSort, applySort } from "@/core/api/sorting";
import { toApiEvent } from "@/core/api/mappers";
import { getEvents } from "@/lib/data";
import type { EventStatus } from "@/core/enums/eventStatus";

export const dynamic = "force-dynamic";

const SORTABLE_FIELDS = ["title", "event_date", "created_at"] as const;

/** Checkpoint 16, Step 4 — `GET /api/v1/events`. `crm.read` scope. Reuses `getEvents()` unchanged. `?search=`/`?status=`/`?client_id=`/`?date_from=`/`?date_to=` map onto `EventFilters`. */
export const GET = createApiHandler("crm.read", async (request): Promise<NextResponse> => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const events = await getEvents({
    search: url.searchParams.get("search") ?? undefined,
    status: status ? (status as EventStatus | "all") : undefined,
    clientId: url.searchParams.get("client_id") ?? undefined,
    dateFrom: url.searchParams.get("date_from") ?? undefined,
    dateTo: url.searchParams.get("date_to") ?? undefined,
    includeArchived: url.searchParams.get("include_archived") === "true",
  });

  const sorted = applySort(events, parseSort(url, SORTABLE_FIELDS), (event, field) => event[field] ?? "");
  const { items, meta } = paginate(sorted, parsePagination(url));
  return apiSuccess(items.map(toApiEvent), meta);
});
