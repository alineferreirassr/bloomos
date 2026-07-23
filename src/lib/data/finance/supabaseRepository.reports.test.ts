import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));
vi.mock("@/core/audit", () => ({
  getCoreAuditLogService: () => ({ recordAuditEvent: vi.fn(), getAuditLogForOwner: vi.fn() }),
}));

import { supabaseFinanceRepository } from "@/lib/data/finance/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";

function createMockSupabase(responses: Array<{ data: unknown; error: unknown }>) {
  const rpcCalls: { name: string; args: unknown }[] = [];
  let i = 0;
  const client = {
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      if (i >= responses.length) throw new Error(`No mock Supabase response queued for call #${i + 1}`);
      return responses[i++];
    },
  };
  return { client, rpcCalls };
}

const SESSION = {
  status: "ok" as const,
  session: {
    user: { id: "user_1", email: "owner@example.com" },
    profile: {
      id: "user_1",
      full_name: "Amoré Bloom Owner",
      email: "owner@example.com",
      avatar_url: null,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    },
  },
};

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

function generalLedgerRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    account_id: "account_1000",
    account_number: 1000,
    account_name: "Cash",
    account_type: "asset",
    normal_balance: "debit",
    opening_balance_minor: 0,
    journal_entry_id: "entry_1",
    entry_date: "2026-07-10",
    memo: "Test entry",
    source_type: "manual_adjustment",
    source_id: null,
    posting_status: "posted",
    journal_line_id: "line_1",
    line_memo: null,
    debit_minor: 5000,
    credit_minor: 0,
    running_balance_minor: 5000,
    ...overrides,
  };
}

describe("supabaseFinanceRepository.getGeneralLedgerReport", () => {
  it("calls finance_general_ledger_report with the current workspace and filters, and groups rows by account", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([{ data: [generalLedgerRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const report = await supabaseFinanceRepository.getGeneralLedgerReport({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      accountId: "account_1000",
    });

    expect(rpcCalls[0].name).toBe("finance_general_ledger_report");
    expect(rpcCalls[0].args).toEqual({
      p_workspace_id: "workspace_1",
      p_start_date: "2026-07-01",
      p_end_date: "2026-07-31",
      p_account_id: "account_1000",
      p_account_type: null,
      p_source_type: null,
    });
    expect(report.accounts).toHaveLength(1);
    expect(report.accounts[0].transactions).toHaveLength(1);
    expect(report.accounts[0].closingBalanceMinor).toBe(5000);
  });

  it("represents an account with zero in-range activity as a zero-transaction row, not an omission", async () => {
    mockSession();
    const zeroActivityRow = generalLedgerRow({
      journal_entry_id: null,
      entry_date: null,
      memo: null,
      source_type: null,
      source_id: null,
      posting_status: null,
      journal_line_id: null,
      debit_minor: null,
      credit_minor: null,
      opening_balance_minor: 8000,
      running_balance_minor: 8000,
    });
    const { client } = createMockSupabase([{ data: [zeroActivityRow], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const report = await supabaseFinanceRepository.getGeneralLedgerReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    expect(report.accounts[0].transactions).toHaveLength(0);
    expect(report.accounts[0].openingBalanceMinor).toBe(8000);
    expect(report.accounts[0].closingBalanceMinor).toBe(8000);
  });

  it("throws a safe Error for an invalid date range (P1200), not a raw Postgres internal", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: { code: "P1200", message: "End date must not be before start date." } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(
      supabaseFinanceRepository.getGeneralLedgerReport({ startDate: "2026-07-31", endDate: "2026-07-01" }),
    ).rejects.toThrow(/end date must not be before start date/i);
  });
});

describe("supabaseFinanceRepository.getTrialBalanceReport", () => {
  it("calls finance_trial_balance_report with the current workspace and computes ending balances client-side from raw totals", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      {
        data: [
          {
            account_id: "account_1000",
            account_number: 1000,
            account_name: "Cash",
            account_type: "asset",
            normal_balance: "debit",
            is_archived: false,
            total_debit_minor: 8000,
            total_credit_minor: 3000,
          },
          {
            account_id: "account_4000",
            account_number: 4000,
            account_name: "Service Revenue",
            account_type: "revenue",
            normal_balance: "credit",
            is_archived: false,
            total_debit_minor: 0,
            total_credit_minor: 5000,
          },
        ],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const report = await supabaseFinanceRepository.getTrialBalanceReport({ asOfDate: "2026-07-31" });

    expect(rpcCalls[0].name).toBe("finance_trial_balance_report");
    expect(rpcCalls[0].args).toEqual({ p_workspace_id: "workspace_1", p_as_of_date: "2026-07-31", p_include_zero_balances: false });
    expect(report.rows[0].endingDebitMinor).toBe(5000);
    expect(report.rows[0].endingCreditMinor).toBe(0);
    expect(report.isBalanced).toBe(true);
  });

  it("detects an unbalanced result from mismatched RPC rows without silently correcting it", async () => {
    mockSession();
    const { client } = createMockSupabase([
      {
        data: [
          { account_id: "a1", account_number: 1000, account_name: "Cash", account_type: "asset", normal_balance: "debit", is_archived: false, total_debit_minor: 9000, total_credit_minor: 0 },
          { account_id: "a2", account_number: 4000, account_name: "Revenue", account_type: "revenue", normal_balance: "credit", is_archived: false, total_debit_minor: 0, total_credit_minor: 8000 },
        ],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const report = await supabaseFinanceRepository.getTrialBalanceReport({ asOfDate: "2026-07-31" });
    expect(report.isBalanced).toBe(false);
  });
});

describe("supabaseFinanceRepository.getProfitAndLossReport", () => {
  it("calls finance_profit_and_loss_report and assembles sections via the shared calculation helpers", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      {
        data: [
          {
            account_id: "account_4000",
            account_number: 4000,
            account_name: "Service Revenue",
            account_type: "revenue",
            normal_balance: "credit",
            current_debit_minor: 0,
            current_credit_minor: 10000,
            comparison_debit_minor: 0,
            comparison_credit_minor: 0,
          },
        ],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const report = await supabaseFinanceRepository.getProfitAndLossReport({ startDate: "2026-07-01", endDate: "2026-07-31" });

    expect(rpcCalls[0].name).toBe("finance_profit_and_loss_report");
    expect(rpcCalls[0].args).toEqual({
      p_workspace_id: "workspace_1",
      p_start_date: "2026-07-01",
      p_end_date: "2026-07-31",
      p_comparison_start_date: null,
      p_comparison_end_date: null,
    });
    expect(report.netIncomeMinor).toBe(10000);
    expect(report.comparisonNetIncomeMinor).toBeNull();
  });

  it("passes comparison period dates through to the RPC when requested", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseFinanceRepository.getProfitAndLossReport({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      comparison: { startDate: "2026-06-01", endDate: "2026-06-30" },
    });

    expect(rpcCalls[0].args).toMatchObject({ p_comparison_start_date: "2026-06-01", p_comparison_end_date: "2026-06-30" });
  });
});

describe("supabaseFinanceRepository.getBalanceSheetReport", () => {
  it("calls finance_balance_sheet_report and folds current_period_earnings_minor into Equity", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      {
        data: [
          {
            account_id: "account_1000",
            account_number: 1000,
            account_name: "Cash",
            account_type: "asset",
            parent_account_id: null,
            closing_balance_minor: 8000,
            current_period_earnings_minor: 8000,
          },
        ],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const report = await supabaseFinanceRepository.getBalanceSheetReport({ asOfDate: "2026-07-31" });

    expect(rpcCalls[0].name).toBe("finance_balance_sheet_report");
    expect(rpcCalls[0].args).toEqual({ p_workspace_id: "workspace_1", p_as_of_date: "2026-07-31" });
    expect(report.currentPeriodEarningsMinor).toBe(8000);
    expect(report.totalAssetsMinor).toBe(8000);
    expect(report.isBalanced).toBe(true);
  });

  it("reports an unbalanced accounting equation without silently adjusting it", async () => {
    mockSession();
    const { client } = createMockSupabase([
      {
        data: [
          { account_id: "a1", account_number: 1000, account_name: "Cash", account_type: "asset", parent_account_id: null, closing_balance_minor: 10000, current_period_earnings_minor: 0 },
          { account_id: "a2", account_number: 2000, account_name: "AP", account_type: "liability", parent_account_id: null, closing_balance_minor: 3000, current_period_earnings_minor: 0 },
        ],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const report = await supabaseFinanceRepository.getBalanceSheetReport({ asOfDate: "2026-07-31" });
    expect(report.isBalanced).toBe(false);
  });
});
