import { getProposalsRepository } from "@/lib/data/proposals";
import { getDailyBriefExecutionsRepository } from "@/lib/data/dailyBrief";
import { registerMetric } from "@/core/analytics/metricRegistry";
import { buildMetricResult, filterInWindow, groupByDay } from "@/core/analytics/engine";
import type { MetricComputeContext, MetricComputeResult } from "@/types/analytics";

const HISTORY_LIMIT = 10000;

/**
 * Checkpoint 15 — AI category metrics. "AI Usage" sums two real,
 * already-persisted generation records — Proposal drafts
 * (`ProposalsRepository.getRecentProposals`) and Daily Operations Brief
 * runs (`DailyBriefExecutionsRepository.getRecentExecutions`) — the same
 * two sources `getBloomAIOverview.ts` already reads for its own Usage
 * Statistics. Never a new AI-call counter, never double-counted: each
 * Skill's own execution history stays in its own store, this metric only
 * sums their counts.
 */

const aiUsage = {
  id: "ai.usage",
  name: "AI Usage",
  description: "Proposal drafts and Daily Operations Briefs generated within the selected window.",
  category: "ai" as const,
  unit: "count" as const,
  icon: "Sparkles",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const [proposals, briefs] = await Promise.all([
      getProposalsRepository().getRecentProposals(context.workspaceId, HISTORY_LIMIT),
      getDailyBriefExecutionsRepository().getRecentExecutions(context.workspaceId, HISTORY_LIMIT),
    ]);
    const events = [
      ...proposals.map((proposal) => ({ occurred_at: proposal.created_at })),
      ...briefs.map((brief) => ({ occurred_at: brief.created_at })),
    ];
    const dateOf = (event: (typeof events)[number]) => event.occurred_at;
    const current = filterInWindow(events, dateOf, context.window).length;
    const previous = filterInWindow(events, dateOf, context.previousWindow).length;
    const series = groupByDay(events, dateOf, () => 1, context.window);
    return buildMetricResult(current, previous, series);
  },
};

const dailyBriefSuccessRate = {
  id: "ai.dailyBriefSuccessRate",
  name: "Daily Brief Success Rate",
  description: "Share of Daily Operations Brief generations within the window that succeeded.",
  category: "ai" as const,
  unit: "percent" as const,
  icon: "Newspaper",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const briefs = await getDailyBriefExecutionsRepository().getRecentExecutions(context.workspaceId, HISTORY_LIMIT);
    const dateOf = (brief: (typeof briefs)[number]) => brief.created_at;

    const rateFor = (window: typeof context.window): number => {
      const cohort = filterInWindow(briefs, dateOf, window);
      if (cohort.length === 0) return 0;
      const succeeded = cohort.filter((brief) => brief.status === "success").length;
      return (succeeded / cohort.length) * 100;
    };

    return buildMetricResult(rateFor(context.window), rateFor(context.previousWindow));
  },
};

let registered = false;

export function registerAiMetrics(): void {
  if (registered) return;
  registerMetric(aiUsage);
  registerMetric(dailyBriefSuccessRate);
  registered = true;
}
