import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { listWorkspaceReceipts } from "@/modules/finance/receipts";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 5 — `GET /api/v1/receipts`. `finance.read` scope. `?invoice_id=`/`?client_id=` narrow the results. */
export const GET = createApiHandler("finance.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const receipts = await listWorkspaceReceipts(auth.workspaceId, {
    invoiceId: url.searchParams.get("invoice_id") ?? undefined,
    clientId: url.searchParams.get("client_id") ?? undefined,
  });
  const { items, meta } = paginate(receipts, parsePagination(url));
  return apiSuccess(items, meta);
});
