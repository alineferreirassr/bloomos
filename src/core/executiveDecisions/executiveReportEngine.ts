import type { Decision, ExecutiveInsights, ExecutiveReport, WorkspaceExecutiveScorecard } from "@/types/executiveDecisions";

/**
 * v2.0 Checkpoint 25.7, Step 12 — Executive Report Engine. Every section
 * is a plain template composed over already-computed `Decision[]`/
 * `WorkspaceExecutiveScorecard`/`ExecutiveInsights` — zero new data
 * access, zero new detection.
 */

const RISK_CATEGORIES_BUSINESS = new Set(["compliance", "security", "finance"]);
const HIGH_OR_ABOVE = new Set(["critical", "high"]);

export interface ExecutiveReportInput {
  scorecard: WorkspaceExecutiveScorecard;
  /** The already-ordered, queue-eligible Decisions (`executiveQueueEngine.buildExecutiveQueue`'s output). */
  queue: Decision[];
  resolvedDecisions: Decision[];
  /** Decisions currently gated by at least one unmet dependency — supplied by the caller, which already ran `decisionEngine.evaluateDecisionDependencies` per Decision. */
  blockedDecisions: Decision[];
  insights: ExecutiveInsights;
  evaluatedAt: string;
}

export function generateExecutiveReport(input: ExecutiveReportInput): ExecutiveReport {
  const critical = input.queue.filter((d) => d.priority === "critical");
  const businessRisks = input.queue.filter((d) => RISK_CATEGORIES_BUSINESS.has(d.category) && HIGH_OR_ABOVE.has(d.priority));
  const operationalRisks = input.queue.filter((d) => !RISK_CATEGORIES_BUSINESS.has(d.category) && HIGH_OR_ABOVE.has(d.priority));

  // The queue's own top items, plus up to two insight-derived suggestions naming the most-affected client/event — never a new recommendation, just the same `ExecutiveInsights` (Step 13) restated as an improvement.
  const insightImprovements: string[] = [];
  if (input.insights.mostImpactedClients[0]) insightImprovements.push(`Reduce open decisions affecting ${input.insights.mostImpactedClients[0].label} (${input.insights.mostImpactedClients[0].count} open).`);
  if (input.insights.mostOverloadedEvents[0]) insightImprovements.push(`Reduce open decisions affecting ${input.insights.mostOverloadedEvents[0].label} (${input.insights.mostOverloadedEvents[0].count} open).`);
  const topImprovements = [...input.queue.slice(0, 5).map((d) => d.title), ...insightImprovements];

  const executiveSummary =
    `Overall Executive Score is ${input.scorecard.overallExecutiveScore}/100. ` +
    `${input.queue.length} decision(s) await attention, ${critical.length} of them critical. ` +
    `${input.resolvedDecisions.length} decision(s) have been resolved; ${input.blockedDecisions.length} are currently blocked.`;

  return {
    executiveSummary,
    criticalIssues: critical.map((d) => d.title),
    businessRisks: businessRisks.map((d) => d.title),
    operationalRisks: operationalRisks.map((d) => d.title),
    decisionQueueSummary:
      input.queue.length === 0
        ? "The Executive Queue is empty — nothing currently needs attention."
        : `${input.queue.length} decision(s) in the queue, led by "${input.queue[0].title}" (${input.queue[0].priority}).`,
    completedDecisionsSummary: input.resolvedDecisions.length === 0 ? "No decisions have been resolved yet." : `${input.resolvedDecisions.length} decision(s) resolved.`,
    blockedDecisionsSummary: input.blockedDecisions.length === 0 ? "No decisions are currently blocked." : `${input.blockedDecisions.length} decision(s) are blocked: ${input.blockedDecisions.map((d) => d.title).join("; ")}.`,
    topImprovements,
    evaluatedAt: input.evaluatedAt,
  };
}
