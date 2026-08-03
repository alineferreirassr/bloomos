/** Generated from ServiceBudgetTemplateLine at assignment time — a forward-looking estimate that feeds a new "Estimated Budget" view alongside (never replacing) Finance's real, ledger-derived EventFinancialSummary. Never writes a real Invoice/Expense/Payment. */
export interface EventServiceBudgetLine {
  id: string;
  workspace_id: string;
  event_service_id: string;
  label: string;
  category: string | null;
  estimated_revenue_minor: number;
  estimated_cost_minor: number;
  created_at: string;
  updated_at: string;
}
