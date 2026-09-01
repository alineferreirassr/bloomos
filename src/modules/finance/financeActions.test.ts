import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));
vi.mock("@/lib/data", () => ({
  getContractFinanceSummary: vi.fn(),
  getWorkspaceFinancialSummary: vi.fn(),
  getProfitAndLossReport: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getContractFinanceSummary, getWorkspaceFinancialSummary, getProfitAndLossReport } from "@/lib/data";
import { getContractFinancialSummaryAction, getFinancialReconciliationDiagnosticAction } from "@/modules/finance/financeActions";
import { makeInvoice } from "@/modules/finance/testUtils";

const founderSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: [
    "finance.view",
    "finance.amounts.view",
    "finance.accounting.view",
    "finance.reports.view",
    "finance.executive.view",
  ],
  workspaceDisplayName: "Amoré Bloom",
};

/** Manager's real default from permissionMatrix.ts: finance.view + finance.amounts.view, no executive/accounting/reports. */
const managerSession: MemberSessionSnapshot = {
  ...founderSession,
  membership: { ...founderSession.membership, id: "member_2", role: "manager" },
  permissions: ["finance.view", "finance.amounts.view"],
};

/** Staff's real default from permissionMatrix.ts: finance.view only. */
const staffSession: MemberSessionSnapshot = {
  ...founderSession,
  membership: { ...founderSession.membership, id: "member_3", role: "staff" },
  permissions: ["finance.view"],
};

const rawSummary = {
  invoices: [
    makeInvoice({ id: "invoice_1", invoice_number: "INV-2026-0001", status: "sent", currency: "USD", total_minor: 250000 }),
  ],
  totalInvoicedMinor: 250000,
  totalCollectedMinor: 100000,
  outstandingMinor: 150000,
  depositStatus: "deposit_partial" as const,
  depositRequiredMinor: 250000,
  depositPaidMinor: 100000,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("getContractFinancialSummaryAction (Phase 06C)", () => {
  it("Founder sees the real, authorized monetary totals", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(founderSession);
    vi.mocked(getContractFinanceSummary).mockResolvedValue(rawSummary);

    const result = await getContractFinancialSummaryAction("contract_1");

    expect(result.data?.totalInvoicedMinor).toBe(250000);
    expect(result.data?.invoices[0].total_minor).toBe(250000);
  });

  it("Manager with finance.amounts.view sees the real operational totals", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(managerSession);
    vi.mocked(getContractFinanceSummary).mockResolvedValue(rawSummary);

    const result = await getContractFinancialSummaryAction("contract_1");

    expect(result.data?.totalInvoicedMinor).toBe(250000);
    expect(result.data?.outstandingMinor).toBe(150000);
    expect(result.data?.invoices[0].total_minor).toBe(250000);
  });

  it("Staff without finance.amounts.view does NOT receive monetary totals — every money field is redacted to null", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(staffSession);
    vi.mocked(getContractFinanceSummary).mockResolvedValue(rawSummary);

    const result = await getContractFinancialSummaryAction("contract_1");

    expect(result.data?.totalInvoicedMinor).toBeNull();
    expect(result.data?.totalCollectedMinor).toBeNull();
    expect(result.data?.outstandingMinor).toBeNull();
    expect(result.data?.depositRequiredMinor).toBeNull();
    expect(result.data?.depositPaidMinor).toBeNull();
    expect(result.data?.invoices[0].total_minor).toBeNull();
    // Operational, non-monetary fields remain visible even without finance.amounts.view.
    expect(result.data?.depositStatus).toBe("deposit_partial");
    expect(result.data?.invoices[0].invoice_number).toBe("INV-2026-0001");
    expect(result.data?.invoices[0].status).toBe("sent");
  });

  it("omits the card entirely (data: null) for a caller lacking finance.view altogether", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...founderSession, permissions: [] });
    const result = await getContractFinancialSummaryAction("contract_1");
    expect(result.data).toBeNull();
    expect(getContractFinanceSummary).not.toHaveBeenCalled();
  });

  it("never introduces profit/margin fields — the redacted shape has no gross/net profit keys at all", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(founderSession);
    vi.mocked(getContractFinanceSummary).mockResolvedValue(rawSummary);

    const result = await getContractFinancialSummaryAction("contract_1");

    expect(result.data).not.toHaveProperty("gross_profit_minor");
    expect(result.data).not.toHaveProperty("net_profit_minor");
    expect(result.data).not.toHaveProperty("grossProfitMinor");
    expect(result.data).not.toHaveProperty("netProfitMinor");
  });
});

const unauthenticatedSession = { kind: "unauthenticated" as const };

const workspaceSummaryFixture = {
  revenue_this_month_minor: 500000,
  collected_this_month_minor: 400000,
  outstanding_receivables_minor: 100000,
  overdue_receivables_minor: 0,
  expenses_this_month_minor: 150000,
  gross_profit_minor: 350000,
  net_profit_minor: 250000,
  deposits_pending_minor: 0,
  refunds_this_month_minor: 0,
};

function plReportFixture(operatingExpenseMinor: number) {
  return {
    workspaceId: "ws_amore_bloom",
    generatedAt: "2026-08-01T00:00:00.000Z",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    comparisonStartDate: null,
    comparisonEndDate: null,
    sections: [
      { kind: "revenue" as const, label: "Revenue", rows: [], totalCurrentPeriodMinor: 0, totalComparisonPeriodMinor: null, totalVarianceMinor: null },
      {
        kind: "operating_expense" as const,
        label: "Operating Expenses",
        rows: [],
        totalCurrentPeriodMinor: operatingExpenseMinor,
        totalComparisonPeriodMinor: null,
        totalVarianceMinor: null,
      },
    ],
    netIncomeMinor: -operatingExpenseMinor,
    comparisonNetIncomeMinor: null,
  };
}

// F1.5 — the Founder-only reconciliation diagnostic. Deliberately reuses
// founderSession/managerSession/staffSession above rather than redefining
// role fixtures, per this pass's own "reuse existing F1 tests" instruction.
describe("getFinancialReconciliationDiagnosticAction (Finance F1.5)", () => {
  it("Founder (finance.executive.view) receives the diagnostic result", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(founderSession);
    vi.mocked(getWorkspaceFinancialSummary).mockResolvedValue(workspaceSummaryFixture);
    vi.mocked(getProfitAndLossReport).mockResolvedValue(plReportFixture(150000));

    const result = await getFinancialReconciliationDiagnosticAction();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.isReconciled).toBe(true);
    expect(result.data.discrepancies).toEqual([]);
  });

  it("denies a Manager who holds finance.amounts.view but not finance.executive.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(managerSession);
    const result = await getFinancialReconciliationDiagnosticAction();
    expect(result.success).toBe(false);
    expect(getWorkspaceFinancialSummary).not.toHaveBeenCalled();
    expect(getProfitAndLossReport).not.toHaveBeenCalled();
  });

  it("denies ordinary Staff (finance.view only)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(staffSession);
    const result = await getFinancialReconciliationDiagnosticAction();
    expect(result.success).toBe(false);
    expect(getWorkspaceFinancialSummary).not.toHaveBeenCalled();
  });

  it("denies an unauthenticated caller, per the same convention every other action in this file uses", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(unauthenticatedSession);
    const result = await getFinancialReconciliationDiagnosticAction();
    expect(result.success).toBe(false);
    expect(getWorkspaceFinancialSummary).not.toHaveBeenCalled();
  });

  it("detects a real expense mismatch between the operational total and the ledger's operating_expense total", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(founderSession);
    vi.mocked(getWorkspaceFinancialSummary).mockResolvedValue(workspaceSummaryFixture); // expenses_this_month_minor: 150000
    vi.mocked(getProfitAndLossReport).mockResolvedValue(plReportFixture(90000)); // ledger only saw 90000 — e.g. a legacy-path expense never posted

    const result = await getFinancialReconciliationDiagnosticAction();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.isReconciled).toBe(false);
    expect(result.data.discrepancies).toEqual([
      { metric: "expense", operationalMinor: 150000, ledgerMinor: 90000, differenceMinor: 60000 },
    ]);
  });

  it("marks revenue and net_income not-comparable, never fabricating a mismatch for the metric BloomOS's ledger can't yet recognize", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(founderSession);
    vi.mocked(getWorkspaceFinancialSummary).mockResolvedValue(workspaceSummaryFixture);
    vi.mocked(getProfitAndLossReport).mockResolvedValue(plReportFixture(150000));

    const result = await getFinancialReconciliationDiagnosticAction();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.notComparableMetrics).toEqual(["revenue", "net_income"]);
    expect(result.data.notComparableReason).toContain("Revenue and Net Income aren't compared");
  });

  it("never mutates and produces no side effects — calling it twice with the same mocked data returns equal results", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(founderSession);
    vi.mocked(getWorkspaceFinancialSummary).mockResolvedValue(workspaceSummaryFixture);
    vi.mocked(getProfitAndLossReport).mockResolvedValue(plReportFixture(150000));

    const first = await getFinancialReconciliationDiagnosticAction();
    const second = await getFinancialReconciliationDiagnosticAction();
    expect(first).toEqual(second);
  });

  it("uses exact integer minor-unit arithmetic — a one-cent difference is detected, not rounded away", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(founderSession);
    vi.mocked(getWorkspaceFinancialSummary).mockResolvedValue({ ...workspaceSummaryFixture, expenses_this_month_minor: 150001 });
    vi.mocked(getProfitAndLossReport).mockResolvedValue(plReportFixture(150000));

    const result = await getFinancialReconciliationDiagnosticAction();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.isReconciled).toBe(false);
    expect(result.data.discrepancies[0].differenceMinor).toBe(1);
  });
});
