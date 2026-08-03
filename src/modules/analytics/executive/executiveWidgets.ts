/**
 * v2 Checkpoint 23, Step 14 — the fixed set of widget ids the Executive
 * Dashboard's own KPI tiles are keyed by. A plain ordered array (not a
 * registry) since these are static, one-per-checkpoint tiles, not a
 * dynamically-registered set like the Metrics Registry — matching the
 * closed-set precedent the rest of this checkpoint's own constants use.
 */
export const EXECUTIVE_DASHBOARD_WIDGET_IDS = [
  "todaysRevenue",
  "monthlyRevenue",
  "revenueGrowth",
  "profit",
  "expenses",
  "cashFlow",
  "pipelineValue",
  "upcomingEvents",
  "eventsThisMonth",
  "conversionRate",
  "averageTicket",
  "averageDeposit",
  "outstandingPayments",
  "customerLifetimeValue",
] as const;

export type ExecutiveDashboardWidgetId = (typeof EXECUTIVE_DASHBOARD_WIDGET_IDS)[number];

export const EXECUTIVE_DASHBOARD_WIDGET_LABELS: Record<ExecutiveDashboardWidgetId, string> = {
  todaysRevenue: "Today's Revenue",
  monthlyRevenue: "Monthly Revenue",
  revenueGrowth: "Revenue Growth",
  profit: "Profit",
  expenses: "Expenses",
  cashFlow: "Cash Flow",
  pipelineValue: "Pipeline Value",
  upcomingEvents: "Upcoming Events",
  eventsThisMonth: "Events This Month",
  conversionRate: "Conversion Rate",
  averageTicket: "Average Ticket",
  averageDeposit: "Average Deposit",
  outstandingPayments: "Outstanding Payments",
  customerLifetimeValue: "Customer Lifetime Value",
};
