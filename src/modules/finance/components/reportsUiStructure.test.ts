import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Static, file-level guardrails for the Finance Reports UI phase — separate
 * from behavioral component tests. These exist because the brief for this
 * phase draws a hard scope line (Reports UI only: no Cash Flow/AR Aging/AP
 * Aging UI, no exports, no Stripe, no new calculation logic, no direct
 * Supabase access from a UI component) that a normal render test can't
 * verify, since a component simply not exercising a forbidden path proves
 * nothing about whether the path exists in the file at all.
 */

const COMPONENTS_DIR = path.resolve(__dirname);
const ROUTES_DIR = path.resolve(__dirname, "../../../app/(app)/finance/reports");

const REPORT_UI_FILES = [
  "ReportsOverviewView.tsx",
  "FinanceReportsNav.tsx",
  "MoneyCell.tsx",
  "VarianceCell.tsx",
  "ReportInvariantAlert.tsx",
  "GeneralLedgerFilters.tsx",
  "GeneralLedgerAccountSection.tsx",
  "GeneralLedgerReportView.tsx",
  "TrialBalanceFilters.tsx",
  "TrialBalanceTable.tsx",
  "TrialBalanceReportView.tsx",
  "ProfitAndLossFilters.tsx",
  "ProfitAndLossSectionTable.tsx",
  "ProfitAndLossReportView.tsx",
  "BalanceSheetFilters.tsx",
  "BalanceSheetSectionTable.tsx",
  "BalanceSheetReportView.tsx",
];

function readComponent(filename: string): string {
  return readFileSync(path.join(COMPONENTS_DIR, filename), "utf-8");
}

function readAllRouteFiles(): { name: string; content: string }[] {
  const results: { name: string; content: string }[] = [];
  function walk(dir: string, prefix: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith(".tsx")) {
        results.push({ name: `${prefix}${entry.name}`, content: readFileSync(path.join(dir, entry.name), "utf-8") });
      }
    }
  }
  walk(ROUTES_DIR, "");
  return results;
}

describe("Finance Reports UI structural guardrails", () => {
  it("contains exactly the 5 report routes, no deferred-report routes", () => {
    const routeDirs = readdirSync(ROUTES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(routeDirs).toEqual(["balance-sheet", "general-ledger", "profit-and-loss", "trial-balance"]);
    expect(routeDirs).not.toContain("cash-flow");
    expect(routeDirs).not.toContain("ar-aging");
    expect(routeDirs).not.toContain("ap-aging");

    const files = readAllRouteFiles();
    expect(files).toHaveLength(5); // overview page.tsx + 4 report page.tsx files
  });

  it("route files are thin wrappers only — no direct data-layer or Supabase imports", () => {
    for (const { name, content } of readAllRouteFiles()) {
      expect(content, `${name} should not import Supabase directly`).not.toMatch(/@\/lib\/supabase/);
      expect(content, `${name} should not import @\\/lib\\/data directly`).not.toMatch(/@\/lib\/data["']/);
    }
  });

  it("no Reports UI component imports the Supabase client directly", () => {
    for (const filename of REPORT_UI_FILES) {
      const content = readComponent(filename);
      expect(content, `${filename} must not import @/lib/supabase`).not.toMatch(/from ["']@\/lib\/supabase/);
      expect(content, `${filename} must not import createClient`).not.toMatch(/createClient/);
      expect(content, `${filename} must not reference supabase.from(`).not.toMatch(/supabase\s*\.from\(/);
    }
  });

  it("no Reports UI component implements Cash Flow, AR Aging, AP Aging, or Stripe — deferred reports may only be mentioned as unavailable, never rendered", () => {
    // ReportsOverviewView.tsx legitimately says the words "Cash Flow" / "Accounts Receivable
    // Aging" / "Accounts Payable Aging" once, in its plain-English deferred-reports notice — the
    // brief explicitly permits that. What must never appear anywhere is a signal of an actual
    // implementation: the deferred domain types/repository calls, or a route/component for one.
    const forbiddenImplementationSignals = [
      /CashFlowReport|CashFlowSection|getCashFlowReport/,
      /AccountsReceivableAgingReport|getAccountsReceivableAgingReport/,
      /AccountsPayableAgingReport|getAccountsPayableAgingReport/,
      /\bstripe\b/i,
    ];
    for (const filename of REPORT_UI_FILES) {
      const content = readComponent(filename);
      for (const pattern of forbiddenImplementationSignals) {
        expect(content, `${filename} must not implement a deferred report or Stripe (matched ${pattern})`).not.toMatch(pattern);
      }
    }
  });

  it("the deferred-reports notice on the Overview page mentions Cash Flow/AR/AP Aging as unavailable, with no link", () => {
    const content = readComponent("ReportsOverviewView.tsx");
    expect(content).toMatch(/cash flow.*accounts receivable aging.*accounts payable aging.*planned but not yet available/i);
    expect(content).not.toMatch(/href=.*cash-flow/i);
    expect(content).not.toMatch(/href=.*aging/i);
  });

  it("no Reports UI component implements export, print, or a custom report builder", () => {
    for (const filename of REPORT_UI_FILES) {
      const content = readComponent(filename);
      expect(content, `${filename} must not implement CSV export`).not.toMatch(/csv/i);
      expect(content, `${filename} must not implement PDF export`).not.toMatch(/pdf/i);
      expect(content, `${filename} must not implement a print layout`).not.toMatch(/window\.print|@media print/i);
      expect(content, `${filename} must not implement a report builder`).not.toMatch(/report[\s-]?builder/i);
    }
  });

  it("no Reports UI component duplicates accounting calculation helpers", () => {
    const forbiddenHelperNames = [
      "calculateNormalBalance",
      "calculateRunningBalance",
      "splitEndingBalance",
      "validateTrialBalance",
      "validateAccountingEquation",
      "buildProfitAndLossSections",
      "buildBalanceSheetSections",
    ];
    for (const filename of REPORT_UI_FILES) {
      const content = readComponent(filename);
      for (const helper of forbiddenHelperNames) {
        // These helpers live exclusively in reportCalculations.ts (Reports Foundation, out of
        // this phase's scope) — a Reports UI component may never define or reimplement one.
        expect(content, `${filename} must not define/reimplement ${helper}`).not.toMatch(new RegExp(`function ${helper}`));
      }
    }
  });

  it("no migration files were added or changed by the Reports UI phase", () => {
    const migrationsDir = path.resolve(__dirname, "../../../../supabase/migrations");
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    // The last migration committed in the Finance Reports Foundation checkpoint remains the
    // newest file — the Reports UI phase adds zero new .sql files.
    expect(files).toContain("20260805100000_finance_report_rpcs.sql");
    expect(files.filter((f) => f > "20260805100000_finance_report_rpcs.sql")).toHaveLength(0);
  });
});
