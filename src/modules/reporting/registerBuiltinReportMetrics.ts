import { registerBuiltinMetrics } from "@/modules/analytics/registerBuiltinMetrics";
import { adaptRegisteredAnalyticsMetrics } from "@/core/reporting/metricAdapters";
import { registerReportMetric, resetReportMetricRegistry } from "@/core/reporting/metricRegistry";
import { registerCommercialReportMetrics } from "@/modules/reporting/metrics/commercialMetrics";
import { registerWorkforceReportMetrics } from "@/modules/reporting/metrics/workforceMetrics";
import { registerAssetReportMetrics } from "@/modules/reporting/metrics/assetMetrics";
import { registerCommunicationReportMetrics } from "@/modules/reporting/metrics/communicationMetrics";
import { registerSearchReportMetrics } from "@/modules/reporting/metrics/searchMetrics";
import { registerExecutiveReportMetrics } from "@/modules/reporting/metrics/executiveMetrics";
import { registerOperationsReportMetrics } from "@/modules/reporting/metrics/operationsMetrics";

let registered = false;

/**
 * v2.0 Checkpoint 42 — the one place every Report Metric enters the
 * registry. Idempotent (mirrors `registerBuiltinMetrics()`'s own
 * "call at module load, never twice" contract) — every module action that
 * reads the Report Metric Registry calls this first, the same "self-
 * register on first use" precedent every other registry-backed platform
 * in this codebase already follows.
 */
export function registerBuiltinReportMetrics(): void {
  if (registered) return;
  registered = true;

  registerBuiltinMetrics();
  for (const metric of adaptRegisteredAnalyticsMetrics()) registerReportMetric(metric);

  registerCommercialReportMetrics();
  registerWorkforceReportMetrics();
  registerAssetReportMetrics();
  registerCommunicationReportMetrics();
  registerSearchReportMetrics();
  registerExecutiveReportMetrics();
  registerOperationsReportMetrics();
}

/** Test-only — undoes the module-level idempotency guard so a test file can force a clean re-registration. */
export function resetBuiltinReportMetricsRegistration(): void {
  registered = false;
  resetReportMetricRegistry();
}
