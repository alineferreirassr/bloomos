import type { EventServiceBudgetLine } from "@/types/eventServiceBudgetLine";
import type { EventFinancialSummary } from "@/modules/finance/financialSummary";
import { calculatePercentage, subtractMinor, sumMinor } from "@/lib/money";
import type { OperationsBudget } from "@/core/operations/types";

/**
 * BudgetEngine (v2 Checkpoint 21, Step 9) — one of the few genuinely new
 * aggregations this checkpoint needs (per research, no cross-Event finance
 * aggregate exists, and per-Event *estimated* budget didn't exist before
 * Services' own `EventServiceBudgetLine` rows). Estimated figures come from
 * summing every assigned Service's own `EventServiceBudgetLine` rows
 * (forward-looking, never touches real ledger data); actual figures reuse
 * `EventFinancialSummary` (Checkpoint 8's own ledger-derived numbers)
 * untouched — this engine only combines the two, never recomputes either.
 */

/** Pure — combines already-fetched EventServiceBudgetLine rows (estimate) with an already-fetched EventFinancialSummary (actual) into one Budget Center view. */
export function buildOperationsBudget(budgetLines: EventServiceBudgetLine[], financialSummary: EventFinancialSummary): OperationsBudget {
  const estimatedRevenueMinor = sumMinor(budgetLines.map((line) => line.estimated_revenue_minor));
  const estimatedCostMinor = sumMinor(budgetLines.map((line) => line.estimated_cost_minor));

  const actualRevenueMinor = financialSummary.invoiced_total_minor;
  const actualCostMinor = financialSummary.expense_total_minor;

  const profitMinor = subtractMinor(actualRevenueMinor, actualCostMinor);
  const marginPercentage = calculatePercentage(profitMinor, actualRevenueMinor);

  const forecastVarianceMinor = subtractMinor(actualCostMinor, estimatedCostMinor);
  const forecastNote =
    estimatedCostMinor === 0
      ? "No estimated budget lines yet — assign Services with budget templates to see a forecast."
      : forecastVarianceMinor > 0
        ? `Actual cost is running ${formatMinorForNote(forecastVarianceMinor)} over the estimated budget.`
        : forecastVarianceMinor < 0
          ? `Actual cost is currently ${formatMinorForNote(-forecastVarianceMinor)} under the estimated budget.`
          : "Actual cost matches the estimated budget exactly.";

  return {
    estimatedRevenueMinor,
    estimatedCostMinor,
    actualRevenueMinor,
    actualCostMinor,
    profitMinor,
    marginPercentage,
    forecastVarianceMinor,
    forecastNote,
  };
}

function formatMinorForNote(minor: number): string {
  return `$${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** True once actual cost has exceeded estimated cost by any amount — the single source RiskEngine's "budget_overrun" detector and HealthScoreEngine's "isOverBudget" input should both read from. */
export function isOverBudget(budget: OperationsBudget): boolean {
  return budget.estimatedCostMinor > 0 && budget.actualCostMinor > budget.estimatedCostMinor;
}
