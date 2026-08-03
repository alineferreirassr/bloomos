import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { parseSort, applySort } from "@/core/api/sorting";
import { toApiClient } from "@/core/api/mappers";
import { getClients } from "@/lib/data";
import type { ClientStatus } from "@/core/enums/clientStatus";

export const dynamic = "force-dynamic";

const SORTABLE_FIELDS = ["name", "created_at"] as const;

/** Checkpoint 16, Step 4 — `GET /api/v1/clients`. `crm.read` scope. Reuses `getClients()` unchanged — the exact same read a member with `clients.view` sees internally, never a parallel query. `?search=`/`?status=`/`?include_archived=` map directly onto `ClientFilters`. */
export const GET = createApiHandler("crm.read", async (request): Promise<NextResponse> => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const clients = await getClients({
    search: url.searchParams.get("search") ?? undefined,
    status: status ? (status as ClientStatus | "all") : undefined,
    includeArchived: url.searchParams.get("include_archived") === "true",
  });

  const sorted = applySort(clients, parseSort(url, SORTABLE_FIELDS), (client, field) =>
    field === "name" ? `${client.first_name} ${client.last_name}` : client.created_at,
  );
  const { items, meta } = paginate(sorted, parsePagination(url));
  return apiSuccess(items.map(toApiClient), meta);
});
