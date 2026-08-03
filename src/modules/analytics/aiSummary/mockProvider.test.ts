import { describe, expect, it } from "vitest";
import { createAnalyticsExecutiveSummaryMockProvider } from "@/modules/analytics/aiSummary/mockProvider";
import type { AICompletionRequest } from "@/core/ai/types";
import type { AnalyticsSummaryContext } from "@/modules/analytics/aiSummary/types";

function requestWithContext(context: AnalyticsSummaryContext | undefined): AICompletionRequest {
  return {
    conversation: { id: "conv_1", workspaceId: "ws_1", context: { workspaceId: "ws_1", facts: { analyticsSummaryContext: context } }, messages: [], createdAt: "", updatedAt: "" },
    prompt: { role: "user", content: "" },
  };
}

describe("createAnalyticsExecutiveSummaryMockProvider", () => {
  it("returns a graceful, requiresApproval error response when no context was supplied", async () => {
    const provider = createAnalyticsExecutiveSummaryMockProvider();
    const completion = await provider.complete(requestWithContext(undefined));
    const parsed = JSON.parse(completion.content);
    expect(completion.finishReason).toBe("error");
    expect(parsed.executiveSummary).toContain("No metrics");
  });

  it("narrates only the numbers already present in context — never computes its own value", async () => {
    const provider = createAnalyticsExecutiveSummaryMockProvider();
    const context: AnalyticsSummaryContext = {
      windowKey: "30d",
      metrics: [
        { id: "revenue.total", name: "Revenue", category: "revenue", unit: "currency", value: 650000, changePercent: 47.7, trend: "up" },
        { id: "clients.new", name: "New Clients", category: "clients", unit: "count", value: 1, changePercent: -50, trend: "down" },
      ],
    };
    const completion = await provider.complete(requestWithContext(context));
    const parsed = JSON.parse(completion.content);

    expect(completion.finishReason).toBe("stop");
    expect(parsed.executiveSummary).toContain("2 tracked metric");
    expect(parsed.performanceHighlights.join(" ")).toContain("Revenue");
    expect(parsed.performanceHighlights.join(" ")).toContain("47.7");
    expect(parsed.operationalRisks.join(" ")).toContain("New Clients");
  });

  it("recommends reviewing invoices only when a revenue metric is actually trending down", async () => {
    const provider = createAnalyticsExecutiveSummaryMockProvider();
    const fallingRevenue: AnalyticsSummaryContext = { windowKey: "30d", metrics: [{ id: "revenue.total", name: "Revenue", category: "revenue", unit: "currency", value: 100, changePercent: -10, trend: "down" }] };
    const completion = await provider.complete(requestWithContext(fallingRevenue));
    const parsed = JSON.parse(completion.content);
    expect(parsed.recommendations.join(" ")).toContain("invoices");
  });
});
