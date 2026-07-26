/** One estimated revenue/cost line a Service contributes to an Event's forward-looking Estimated Budget (EventServiceBudgetLine) — deliberately separate from Finance's real, ledger-derived EventFinancialSummary, which this never feeds into automatically. */
export interface ServiceBudgetTemplateLine {
  id: string;
  workspace_id: string;
  service_version_id: string;
  label: string;
  category: string | null;
  estimated_revenue_minor: number;
  estimated_cost_minor: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}
