import { registerReportTemplate } from "@/core/reporting/templateRegistry";
import type { ReportCategory, ReportChartType, ReportDefinition, ReportSection, ReportTemplate } from "@/types/reporting";

/**
 * v2.0 Checkpoint 42, Step 7 — the 15 built-in report templates plus
 * "Custom." Every `metricIds` entry below is a real, registered
 * `ReportMetricDefinition` id — either adapted from
 * `core/analytics/metricRegistry.ts` (prefixed `analytics.`) or one of
 * this checkpoint's own new metrics (`modules/reporting/metrics/*.ts`) —
 * see `docs/report-templates.md` for the full reuse map and for the named
 * templates the checkpoint's own spec listed that were honestly NOT built
 * this checkpoint (no underlying metric exists yet for that domain: Client
 * Portal Engagement, Event Performance, Dispatch Performance, Route
 * Efficiency, Vendor Performance, Knowledge Health — each would otherwise
 * need a fabricated or empty metric list, which this checkpoint's own
 * "never fabricate" discipline rules out).
 */

let section_id = 0;
function section(title: string, chartType: ReportChartType, metricIds: string[]): ReportSection {
  section_id += 1;
  return { id: `section_${section_id}`, title, chartType, metricIds, notes: null };
}

function definition(title: string, description: string, category: ReportCategory, sections: ReportSection[]): ReportDefinition {
  return {
    title,
    description,
    category,
    sections,
    periodKey: "30d",
    customWindow: null,
    comparisonMode: "previous_period",
    groupBy: null,
    sortBy: null,
    filters: [],
    customComparisonWindow: null,
  };
}

function template(id: string, name: string, description: string, category: ReportCategory, def: ReportDefinition): ReportTemplate {
  return { id, name, description, category, builtIn: true, definition: def };
}

export function registerBuiltinReportTemplates(): void {
  registerReportTemplate(
    template(
      "executive_overview",
      "Executive Overview",
      "The workspace's top-level scorecard: executive score, both Business Health composites, objectives, proposals, and receivables.",
      "executive",
      definition("Executive Overview", "Top-level workspace scorecard.", "executive", [
        section("Executive Scorecard", "scorecard", ["executive.overall_score", "executive.objectives_operational_score"]),
        section("Business Health", "health", ["executive.business_health_knowledge_graph", "executive.business_health_finance_crm"]),
        section("Commercial Snapshot", "kpi", ["commercial.proposal_count", "commercial.invoice_outstanding_balance"]),
      ]),
    ),
  );

  registerReportTemplate(
    template(
      "business_health",
      "Business Health Report",
      "Both of BloomOS's Business Health composites, presented side by side.",
      "executive",
      definition("Business Health Report", "Both Business Health composites.", "executive", [section("Business Health", "health", ["executive.business_health_knowledge_graph", "executive.business_health_finance_crm"])]),
    ),
  );

  registerReportTemplate(
    template(
      "revenue_profit",
      "Revenue & Profit Report",
      "Revenue issued and collected within the selected period.",
      "finance",
      definition("Revenue & Profit Report", "Revenue issued and collected.", "finance", [section("Revenue", "trend", ["analytics.revenue.total", "analytics.revenue.collected"])]),
    ),
  );

  registerReportTemplate(
    template(
      "accounts_receivable",
      "Accounts Receivable Report",
      "Outstanding balances and average invoice value.",
      "finance",
      definition("Accounts Receivable Report", "Outstanding balances.", "finance", [section("Receivables", "kpi", ["commercial.invoice_outstanding_balance", "commercial.invoice_average_value"])]),
    ),
  );

  registerReportTemplate(
    template(
      "sales_pipeline",
      "Sales Pipeline Report",
      "New leads, conversion rate, and proposal acceptance.",
      "commercial",
      definition("Sales Pipeline Report", "Lead-to-client pipeline.", "commercial", [
        section("Pipeline", "trend", ["analytics.clients.new", "analytics.clients.conversionRate", "analytics.clients.proposalAcceptance"]),
        section("Journey Conversion", "kpi", ["commercial.journey_conversion_rate"]),
      ]),
    ),
  );

  registerReportTemplate(
    template(
      "proposal_performance",
      "Proposal Performance Report",
      "Proposal volume, acceptance rate, and average value.",
      "commercial",
      definition("Proposal Performance Report", "Proposal volume and acceptance.", "commercial", [
        section("Proposals", "kpi", ["commercial.proposal_count", "commercial.proposal_acceptance_rate", "commercial.proposal_average_value"]),
      ]),
    ),
  );

  registerReportTemplate(
    template(
      "contract_readiness",
      "Contract Readiness Report",
      "Contract document volume and readiness rate.",
      "commercial",
      definition("Contract Readiness Report", "Contract readiness.", "commercial", [section("Contracts", "kpi", ["commercial.contract_count", "commercial.contract_completion_rate"])]),
    ),
  );

  registerReportTemplate(
    template(
      "invoice_billing",
      "Invoice & Billing Report",
      "Invoice volume, outstanding balance, and average invoice value.",
      "commercial",
      definition("Invoice & Billing Report", "Invoice volume and balances.", "commercial", [
        section("Invoices", "kpi", ["commercial.invoice_count", "commercial.invoice_outstanding_balance", "commercial.invoice_average_value"]),
      ]),
    ),
  );

  registerReportTemplate(
    template(
      "client_journey",
      "Client Journey Report",
      "Lead-to-client conversion and deposit completion across the client journey.",
      "commercial",
      definition("Client Journey Report", "Journey conversion and deposits.", "commercial", [
        section("Journey", "kpi", ["commercial.journey_conversion_rate", "commercial.journey_deposit_completion_rate"]),
      ]),
    ),
  );

  registerReportTemplate(
    template(
      "workforce_utilization",
      "Workforce Utilization Report",
      "Worker and team counts, active assignments, and equipment utilization.",
      "workforce",
      definition("Workforce Utilization Report", "Workforce utilization.", "workforce", [
        section("Workforce", "kpi", ["workforce.worker_count", "workforce.team_count", "workforce.active_assignment_count", "workforce.equipment_utilization_rate"]),
      ]),
    ),
  );

  registerReportTemplate(
    template(
      "asset_library",
      "Asset Library Report",
      "Total assets, storage consumed, unused assets, and asset health.",
      "assets",
      definition("Asset Library Report", "Asset Library overview.", "assets", [section("Assets", "kpi", ["assets.total", "assets.total_storage", "assets.unused_count", "assets.health_score"])]),
    ),
  );

  registerReportTemplate(
    template(
      "workflow_automation",
      "Workflow Automation Report",
      "Workflow executions and failure rate.",
      "automation",
      definition("Workflow Automation Report", "Workflow executions and reliability.", "automation", [section("Automation", "trend", ["analytics.workflow.executions", "analytics.workflow.failureRate"])]),
    ),
  );

  registerReportTemplate(
    template(
      "search_performance",
      "Search Performance Report",
      "Search volume, success rate, and Search Health.",
      "search",
      definition("Search Performance Report", "Search usage and health.", "search", [section("Search", "kpi", ["search.total_searches", "search.success_rate", "search.health_score"])]),
    ),
  );

  registerReportTemplate(
    template(
      "notification_engagement",
      "Notification Engagement Report",
      "Notifications created, engagement rate, unread count, and Notification Health.",
      "communication",
      definition("Notification Engagement Report", "Notification engagement.", "communication", [
        section("Notifications", "kpi", ["communication.notifications_created", "communication.notification_engagement_rate", "communication.notifications_unread", "communication.health_score"]),
      ]),
    ),
  );

  registerReportTemplate(
    template(
      "objectives_scorecard",
      "Objectives Scorecard",
      "Overall operational score across every workspace objective.",
      "executive",
      definition("Objectives Scorecard", "Objectives operational score.", "executive", [section("Objectives", "scorecard", ["executive.objectives_operational_score"])]),
    ),
  );

  registerReportTemplate(
    template("custom", "Custom Report", "Start from a blank report and choose your own metrics.", "custom", definition("Untitled Report", "", "custom", [])),
  );
}
