import { registerReportMetric } from "@/core/reporting/metricRegistry";
import { getProposalAnalyticsAction } from "@/modules/proposalPlatform/proposalPlatformActions";
import { getContractAnalyticsAction } from "@/modules/contractPlatform/contractPlatformActions";
import { getInvoiceAnalyticsAction } from "@/modules/invoicePlatform/invoicePlatformActions";
import { getJourneyAnalyticsAction } from "@/modules/clientJourney/clientJourneyActions";
import type { ReportMetricDefinition, ReportMetricResult } from "@/types/reportMetric";

/**
 * v2.0 Checkpoint 42 — Commercial category. Every metric here wraps an
 * already-real Analytics Action from its own platform (Proposal/Contract/
 * Invoice/Client Journey, Checkpoints 33-36) — this file computes nothing
 * itself, it only extracts one named field from each action's own
 * snapshot. None of these actions support a time-window comparison (each
 * is a current-state snapshot, not a time series), so `previousValue` is
 * honestly `null` throughout, never fabricated.
 */

const NA: ReportMetricResult["notApplicableReason"] = null;

function result(value: number | null, unit: ReportMetricResult["unit"]): ReportMetricResult {
  return { value, previousValue: null, unit, series: [], breakdown: [], notApplicableReason: value === null ? "Source action returned no data." : NA, stale: false, partial: false };
}

const proposalCount: ReportMetricDefinition = {
  id: "commercial.proposal_count",
  name: "Proposals",
  description: "Total proposals across every status.",
  category: "commercial",
  unit: "count",
  aggregation: "count",
  sourceModule: "Proposal & Quote Platform (Checkpoint 33)",
  sourceEngine: "getProposalAnalyticsAction() — totalProposals",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["proposal_builder.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getProposalAnalyticsAction();
    return result(r.success ? r.data.totalProposals : null, "count");
  },
};

const proposalAcceptanceRate: ReportMetricDefinition = {
  id: "commercial.proposal_acceptance_rate",
  name: "Proposal Acceptance Rate",
  description: "Share of sent proposals that were accepted.",
  category: "commercial",
  unit: "percent",
  aggregation: "rate",
  sourceModule: "Proposal & Quote Platform (Checkpoint 33)",
  sourceEngine: "getProposalAnalyticsAction() — acceptanceRate",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["proposal_builder.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getProposalAnalyticsAction();
    return result(r.success ? r.data.acceptanceRate * 100 : null, "percent");
  },
};

const proposalAverageValue: ReportMetricDefinition = {
  id: "commercial.proposal_average_value",
  name: "Average Proposal Value",
  description: "Average proposal value across every proposal.",
  category: "commercial",
  unit: "currency",
  aggregation: "average",
  sourceModule: "Proposal & Quote Platform (Checkpoint 33)",
  sourceEngine: "getProposalAnalyticsAction() — averageProposalValue_minor",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["proposal_builder.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getProposalAnalyticsAction();
    return result(r.success ? r.data.averageProposalValue_minor : null, "currency");
  },
};

const contractCount: ReportMetricDefinition = {
  id: "commercial.contract_count",
  name: "Contracts",
  description: "Total contract documents across every status.",
  category: "commercial",
  unit: "count",
  aggregation: "count",
  sourceModule: "Contract Management Platform (Checkpoint 34)",
  sourceEngine: "getContractAnalyticsAction() — totalContracts",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["contract_builder.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getContractAnalyticsAction();
    return result(r.success ? r.data.totalContracts : null, "count");
  },
};

const contractCompletionRate: ReportMetricDefinition = {
  id: "commercial.contract_completion_rate",
  name: "Contract Readiness Rate",
  description: "Share of started contract documents that reached Ready or Published.",
  category: "commercial",
  unit: "percent",
  aggregation: "rate",
  sourceModule: "Contract Management Platform (Checkpoint 34)",
  sourceEngine: "getContractAnalyticsAction() — completionRate",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["contract_builder.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getContractAnalyticsAction();
    return result(r.success ? r.data.completionRate * 100 : null, "percent");
  },
};

const invoiceCount: ReportMetricDefinition = {
  id: "commercial.invoice_count",
  name: "Invoices",
  description: "Total invoice documents across every status.",
  category: "commercial",
  unit: "count",
  aggregation: "count",
  sourceModule: "Invoice & Billing Platform (Checkpoint 35)",
  sourceEngine: "getInvoiceAnalyticsAction() — totalInvoices",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["invoice_builder.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getInvoiceAnalyticsAction();
    return result(r.success ? r.data.totalInvoices : null, "count");
  },
};

const invoiceOutstandingBalance: ReportMetricDefinition = {
  id: "commercial.invoice_outstanding_balance",
  name: "Outstanding Balance",
  description: "Total unpaid balance across every invoice.",
  category: "commercial",
  unit: "currency",
  aggregation: "sum",
  sourceModule: "Invoice & Billing Platform (Checkpoint 35)",
  sourceEngine: "getInvoiceAnalyticsAction() — outstandingBalance_minor",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["invoice_builder.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getInvoiceAnalyticsAction();
    return result(r.success ? r.data.outstandingBalance_minor : null, "currency");
  },
};

const invoiceAverageValue: ReportMetricDefinition = {
  id: "commercial.invoice_average_value",
  name: "Average Invoice Value",
  description: "Average invoice total across every invoice.",
  category: "commercial",
  unit: "currency",
  aggregation: "average",
  sourceModule: "Invoice & Billing Platform (Checkpoint 35)",
  sourceEngine: "getInvoiceAnalyticsAction() — averageInvoice_minor",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["invoice_builder.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getInvoiceAnalyticsAction();
    return result(r.success ? r.data.averageInvoice_minor : null, "currency");
  },
};

const journeyDepositCompletionRate: ReportMetricDefinition = {
  id: "commercial.journey_deposit_completion_rate",
  name: "Deposit Completion Rate",
  description: "Share of client journeys that completed their deposit step.",
  category: "commercial",
  unit: "percent",
  aggregation: "rate",
  sourceModule: "Client Journey & CRM Experience Platform (Checkpoint 32)",
  sourceEngine: "getJourneyAnalyticsAction() — depositCompletionRate",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["client_journeys.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getJourneyAnalyticsAction();
    return result(r.success ? r.data.depositCompletionRate * 100 : null, "percent");
  },
};

const journeyConversionRate: ReportMetricDefinition = {
  id: "commercial.journey_conversion_rate",
  name: "Lead-to-Client Conversion Rate",
  description: "Share of leads that became clients.",
  category: "commercial",
  unit: "percent",
  aggregation: "rate",
  sourceModule: "Client Journey & CRM Experience Platform (Checkpoint 32)",
  sourceEngine: "getJourneyAnalyticsAction() — leadToClientConversionRate",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["client_journeys.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getJourneyAnalyticsAction();
    return result(r.success ? r.data.leadToClientConversionRate * 100 : null, "percent");
  },
};

export function registerCommercialReportMetrics(): void {
  registerReportMetric(proposalCount);
  registerReportMetric(proposalAcceptanceRate);
  registerReportMetric(proposalAverageValue);
  registerReportMetric(contractCount);
  registerReportMetric(contractCompletionRate);
  registerReportMetric(invoiceCount);
  registerReportMetric(invoiceOutstandingBalance);
  registerReportMetric(invoiceAverageValue);
  registerReportMetric(journeyDepositCompletionRate);
  registerReportMetric(journeyConversionRate);
}
