import { describe, expect, it } from "vitest";
import { buildOperationsBudget, isOverBudget } from "@/core/operations/budgetEngine";
import type { EventServiceBudgetLine } from "@/types/eventServiceBudgetLine";
import type { EventFinancialSummary } from "@/modules/finance/financialSummary";

function makeBudgetLine(overrides: Partial<EventServiceBudgetLine> = {}): EventServiceBudgetLine {
  return {
    id: "line_1",
    workspace_id: "ws_1",
    event_service_id: "es_1",
    label: "Floral arrangements",
    category: "flowers",
    estimated_revenue_minor: 500000,
    estimated_cost_minor: 200000,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeFinancialSummary(overrides: Partial<EventFinancialSummary> = {}): EventFinancialSummary {
  return {
    contracted_value_minor: 1000000,
    invoiced_total_minor: 500000,
    collected_minor: 400000,
    refunded_minor: 0,
    outstanding_minor: 100000,
    expense_total_minor: 150000,
    gross_profit_minor: 350000,
    net_profit_minor: 250000,
    deposit_required_minor: 100000,
    deposit_paid_minor: 100000,
    deposit_balance_minor: 0,
    payment_completion_percentage: 80,
    expense_percentage_of_revenue: 30,
    ...overrides,
  };
}

describe("buildOperationsBudget", () => {
  it("sums estimated revenue/cost from real budget lines", () => {
    const budget = buildOperationsBudget(
      [makeBudgetLine({ estimated_revenue_minor: 500000, estimated_cost_minor: 200000 }), makeBudgetLine({ id: "line_2", estimated_revenue_minor: 300000, estimated_cost_minor: 100000 })],
      makeFinancialSummary(),
    );
    expect(budget.estimatedRevenueMinor).toBe(800000);
    expect(budget.estimatedCostMinor).toBe(300000);
  });

  it("derives actual figures straight from EventFinancialSummary, never recomputing them", () => {
    const summary = makeFinancialSummary({ invoiced_total_minor: 700000, expense_total_minor: 200000 });
    const budget = buildOperationsBudget([], summary);
    expect(budget.actualRevenueMinor).toBe(700000);
    expect(budget.actualCostMinor).toBe(200000);
    expect(budget.profitMinor).toBe(500000);
  });

  it("reports an honest 'no estimate yet' forecast note when there are no budget lines", () => {
    const budget = buildOperationsBudget([], makeFinancialSummary());
    expect(budget.forecastNote).toContain("No estimated budget lines yet");
  });

  it("reports over/under budget forecast notes correctly", () => {
    const over = buildOperationsBudget([makeBudgetLine({ estimated_cost_minor: 100000 })], makeFinancialSummary({ expense_total_minor: 150000 }));
    expect(over.forecastVarianceMinor).toBe(50000);
    expect(over.forecastNote).toContain("over the estimated budget");

    const under = buildOperationsBudget([makeBudgetLine({ estimated_cost_minor: 200000 })], makeFinancialSummary({ expense_total_minor: 150000 }));
    expect(under.forecastVarianceMinor).toBe(-50000);
    expect(under.forecastNote).toContain("under the estimated budget");
  });
});

describe("isOverBudget", () => {
  it("is true only when actual cost exceeds a real, non-zero estimate", () => {
    const budget = buildOperationsBudget([makeBudgetLine({ estimated_cost_minor: 100000 })], makeFinancialSummary({ expense_total_minor: 150000 }));
    expect(isOverBudget(budget)).toBe(true);

    const noEstimate = buildOperationsBudget([], makeFinancialSummary({ expense_total_minor: 150000 }));
    expect(isOverBudget(noEstimate)).toBe(false);
  });
});
