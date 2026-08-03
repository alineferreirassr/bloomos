import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getWorkspaceFinancialSummary } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 5 — `GET /api/v1/finance/outstanding-balance`. `finance.read` scope. Reuses `getWorkspaceFinancialSummary()` (`computeWorkspaceFinancialSummary()` underneath) unchanged — the exact same figures the internal Finance Dashboard's own "Outstanding Receivables"/"Overdue Receivables" cards show. */
export const GET = createApiHandler("finance.read", async (): Promise<NextResponse> => {
  const summary = await getWorkspaceFinancialSummary();
  return apiSuccess({
    outstanding_receivables_minor: summary.outstanding_receivables_minor,
    overdue_receivables_minor: summary.overdue_receivables_minor,
    deposits_pending_minor: summary.deposits_pending_minor,
  });
});
