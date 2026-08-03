import { registerRevenueMetrics } from "@/modules/analytics/metrics/revenueMetrics";
import { registerClientMetrics } from "@/modules/analytics/metrics/clientMetrics";
import { registerDocumentMetrics } from "@/modules/analytics/metrics/documentMetrics";
import { registerWorkflowMetrics } from "@/modules/analytics/metrics/workflowMetrics";
import { registerPortalMetrics } from "@/modules/analytics/metrics/portalMetrics";
import { registerAiMetrics } from "@/modules/analytics/metrics/aiMetrics";

let registered = false;

/**
 * Checkpoint 15, Step 1's own "Metrics must self-register" — the one
 * place every built-in metric module actually gets loaded, the same
 * `registerWorkflowNodes()`/`registerAutomationActions()` idempotent-
 * loader shape every other registry in this codebase already uses. Every
 * Analytics entry point (the Dashboard's own data fetch, the AI Executive
 * Summary Skill, tests) calls this once before reading the Metrics
 * Registry.
 */
export function registerBuiltinMetrics(): void {
  if (registered) return;
  registerRevenueMetrics();
  registerClientMetrics();
  registerDocumentMetrics();
  registerWorkflowMetrics();
  registerPortalMetrics();
  registerAiMetrics();
  registered = true;
}
