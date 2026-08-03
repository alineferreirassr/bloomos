import type { AICompletion, AICompletionRequest, AIProvider } from "@/core/ai/types";
import type { EventOperationsBriefContext } from "@/modules/ai/types";

const MOCK_MODEL_NAME = "bloomos-mock-v2";

/**
 * Deterministic, provider-agnostic stand-in used whenever `isAIConfigured()`
 * is false — no OpenAI/Anthropic/any provider is wired into BloomOS yet
 * (see `docs/ai.md`). Never registered into the global registry itself
 * (`registerAIProvider`), since doing so would make `isAIConfigured()` lie
 * about a real provider existing; `generateEventOperationsBrief.ts`
 * instantiates this directly only as a local fallback when no provider is
 * registered, and always reports `mock: true` alongside it.
 *
 * Every sentence below is built from the supplied context's own fields, not
 * a fixed string — regenerating for a different Event, or the same Event
 * after its checklist changes, produces different (but still deterministic
 * for identical input) output, matching the "reflect current stage/health/
 * overdue/next action/missing information" requirement. It never invents a
 * risk `kind` or Health Score of its own — it only narrates the
 * `detectedRisks`/`health` BloomOS already computed and handed it.
 */
export function createMockAIProvider(): AIProvider {
  return {
    name: "mock",
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      const context = request.conversation.context.facts.eventOperationsBriefContext as
        | EventOperationsBriefContext
        | undefined;

      if (!context) {
        return {
          content: JSON.stringify({
            executiveSummary: "No Event context was supplied.",
            healthExplanation: "No Health Score data was supplied.",
            riskExplanations: [],
            recommendedActions: [{ label: "Regenerate this brief", reason: "No context was supplied.", actionTargetType: null }],
            preparationNotes: null,
            internalNotes: null,
          }),
          requiresApproval: true,
          model: MOCK_MODEL_NAME,
          finishReason: "error",
        };
      }

      const summaryParts: string[] = [
        `${context.event.title} is in the ${context.event.lifecycleStage} lifecycle stage (status: ${context.event.status}); Health is ${context.health.status} (${context.health.score}/100).`,
        context.overdueSummary,
      ];
      if (context.schedule.nextItem) {
        summaryParts.push(`Next scheduled item: "${context.schedule.nextItem.title}".`);
      }
      if (context.missingInformation.length > 0) {
        summaryParts.push(`Missing information: ${context.missingInformation.join(", ")}.`);
      }

      const healthExplanation =
        context.health.topFactors.length === 0
          ? `Health is ${context.health.status} at ${context.health.score}/100 — no factors are currently deducting from it.`
          : `Health is ${context.health.status} at ${context.health.score}/100, driven mainly by: ${context.health.topFactors
              .slice(0, 3)
              .map((factor) => `${factor.label} (-${factor.deduction})`)
              .join(", ")}.`;

      const riskExplanations = context.detectedRisks.map((risk) => ({
        kind: risk.kind,
        explanation: `${risk.label} (${risk.severity} severity): ${risk.evidence}`,
      }));

      const recommendedActions: { label: string; reason: string; actionTargetType: "checklist" | "schedule" | "event" | null }[] = [];
      if (context.deterministicNextAction) {
        recommendedActions.push({
          label: context.deterministicNextAction,
          reason: "This is the current recommended next step for this Event's status and stage.",
          actionTargetType: "event",
        });
      }
      for (const overdueTitle of context.checklist.overdueTitles.slice(0, 2)) {
        if (recommendedActions.length >= 5) break;
        recommendedActions.push({
          label: `Follow up on overdue checklist item: "${overdueTitle}"`,
          reason: `This item is past its due date out of ${context.checklist.overdueCount} overdue in total.`,
          actionTargetType: "checklist",
        });
      }
      if (context.schedule.delayedCount > 0) {
        recommendedActions.push({
          label: `Review ${context.schedule.delayedCount} delayed schedule item(s)`,
          reason: `${context.schedule.delayedCount} schedule item(s) are marked delayed.`,
          actionTargetType: "schedule",
        });
      }
      for (const missing of context.missingInformation.slice(0, 2)) {
        if (recommendedActions.length >= 5) break;
        recommendedActions.push({
          label: `Resolve: ${missing}`,
          reason: `This Event is missing information (${missing}) that Health scoring already flags.`,
          actionTargetType: "event",
        });
      }
      if (recommendedActions.length === 0) {
        recommendedActions.push({
          label: "No outstanding operational gaps detected",
          reason: "Continue routine monitoring — nothing currently requires action.",
          actionTargetType: null,
        });
      }

      const output = {
        executiveSummary: summaryParts.join(" "),
        healthExplanation,
        riskExplanations,
        recommendedActions: recommendedActions.slice(0, 5),
        preparationNotes:
          context.deterministicNextAction && context.event.eventDate
            ? `With the event date set, prioritize: ${context.deterministicNextAction.toLowerCase()}.`
            : null,
        internalNotes: context.health.riskReasons.length > 0 ? `Active risk factors: ${context.health.riskReasons.join(", ")}.` : null,
      };

      return {
        content: JSON.stringify(output),
        requiresApproval: true,
        model: MOCK_MODEL_NAME,
        finishReason: "stop",
      };
    },
  };
}
