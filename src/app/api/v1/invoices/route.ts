import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { parseSort, applySort } from "@/core/api/sorting";
import { getInvoices } from "@/lib/data";
import type { InvoiceStatus } from "@/core/enums/invoiceStatus";

export const dynamic = "force-dynamic";

const SORTABLE_FIELDS = ["issue_date", "due_date", "total_minor", "created_at"] as const;

/** Checkpoint 16, Step 5 — `GET /api/v1/invoices`. `finance.read` scope. Reuses `getInvoices()` unchanged. `?status=`/`?client_id=`/`?event_id=`/`?overdue_only=` map onto `InvoiceFilters`. */
export const GET = createApiHandler("finance.read", async (request): Promise<NextResponse> => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const invoices = await getInvoices({
    search: url.searchParams.get("search") ?? undefined,
    status: status ? (status as InvoiceStatus | "all") : undefined,
    clientId: url.searchParams.get("client_id") ?? undefined,
    eventId: url.searchParams.get("event_id") ?? undefined,
    overdueOnly: url.searchParams.get("overdue_only") === "true",
    includeArchived: url.searchParams.get("include_archived") === "true",
  });

  const sorted = applySort(invoices, parseSort(url, SORTABLE_FIELDS), (invoice, field) => invoice[field] ?? "");
  const { items, meta } = paginate(sorted, parsePagination(url));
  return apiSuccess(items, meta);
});
