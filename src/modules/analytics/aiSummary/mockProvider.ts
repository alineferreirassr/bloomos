import type { AICompletion, AICompletionRequest, AIProvider } from "@/core/ai/types";
import type { AnalyticsSummaryContext } from "@/modules/analytics/aiSummary/types";

const MOCK_MODEL_NAME = "bloomos-analytics-mock-v1";

function formatMetricValue(unit: string, value: number): string {
  if (unit === "currency") return `$${(value / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString();
}

/**
 * Deterministic mock — same rationale as `dailyBrief/mockProvider.ts`:
 * never registered into the global registry, always reflects the
 * supplied context's real, already-computed metric values rather than a
 * fixed string. Never performs its own arithmetic beyond simple display
 * formatting (dividing minor currency units, rounding for display) — it
 * narrates `changePercent`/`trend` exactly as computed by the Engine.
 */
export function createAnalyticsExecutiveSummaryMockProvider(): AIProvider {
  return {
    name: "mock",
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      const context = request.conversation.context.facts.analyticsSummaryContext as AnalyticsSummaryContext | undefined;

      if (!context || context.metrics.length === 0) {
        return {
          content: JSON.stringify({ executiveSummary: "No metrics were available for this window.", operationalRisks: [], performanceHighlights: [], recommendations: [] }),
          requiresApproval: true,
          model: MOCK_MODEL_NAME,
          finishReason: "error",
        };
      }

      const rising = context.metrics.filter((metric) => metric.trend === "up");
      const falling = context.metrics.filter((metric) => metric.trend === "down");

      const executiveSummary = `Across ${context.metrics.length} tracked metric(s) this window, ${rising.length} are trending up and ${falling.length} are trending down. ${
        rising.length > falling.length ? "Overall momentum is positive." : falling.length > rising.length ? "Overall momentum needs attention." : "Overall momentum is mixed."
      }`;

      const performanceHighlights = rising
        .slice(0, 5)
        .map((metric) => `${metric.name} is up ${metric.changePercent !== null ? Math.abs(metric.changePercent).toFixed(1) : "—"}% to ${formatMetricValue(metric.unit, metric.value)}.`);

      const operationalRisks = falling
        .slice(0, 5)
        .map((metric) => `${metric.name} is down ${metric.changePercent !== null ? Math.abs(metric.changePercent).toFixed(1) : "—"}% to ${formatMetricValue(metric.unit, metric.value)} — worth a closer look.`);

      const recommendations: string[] = [];
      if (falling.some((metric) => metric.category === "revenue")) recommendations.push("Review outstanding invoices and follow up on overdue balances.");
      if (falling.some((metric) => metric.category === "workflow")) recommendations.push("Check recent Automation executions for a rise in failures.");
      if (falling.some((metric) => metric.category === "portal")) recommendations.push("Reach out to clients whose Portal engagement has dropped.");
      if (recommendations.length === 0 && rising.length > 0) recommendations.push("Continue current operations — most tracked metrics are trending favorably.");

      return {
        content: JSON.stringify({ executiveSummary, operationalRisks, performanceHighlights, recommendations }),
        requiresApproval: true,
        model: MOCK_MODEL_NAME,
        finishReason: "stop",
      };
    },
  };
}
