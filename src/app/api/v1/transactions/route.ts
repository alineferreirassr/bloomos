import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { parseSort, applySort } from "@/core/api/sorting";
import { getPayments } from "@/lib/data";
import type { PaymentStatus } from "@/core/enums/paymentStatus";

export const dynamic = "force-dynamic";

const SORTABLE_FIELDS = ["transaction_date", "amount_minor"] as const;

/** Checkpoint 16, Step 5 — `GET /api/v1/transactions`. `finance.read` scope. Reuses `getPayments()` unchanged — `Payment.payment_type` (`deposit`/`balance`/`refund`/etc.) already distinguishes a refund from a charge, so refunds surface here naturally as their own transaction type, never a separate endpoint. `?refunds_only=` maps onto `PaymentFilters`. */
export const GET = createApiHandler("finance.read", async (request): Promise<NextResponse> => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const payments = await getPayments({
    status: status ? (status as PaymentStatus | "all") : undefined,
    clientId: url.searchParams.get("client_id") ?? undefined,
    invoiceId: url.searchParams.get("invoice_id") ?? undefined,
    refundsOnly: url.searchParams.get("refunds_only") === "true",
  });

  const sorted = applySort(payments, parseSort(url, SORTABLE_FIELDS), (payment, field) => payment[field] ?? "");
  const { items, meta } = paginate(sorted, parsePagination(url));
  return apiSuccess(items, meta);
});
