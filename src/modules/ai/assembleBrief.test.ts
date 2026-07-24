import { describe, expect, it } from "vitest";
import { assembleEventOperationsBrief } from "@/modules/ai/assembleBrief";
import { buildEventOperationsBriefContext } from "@/modules/ai/contextBuilder";
import { makeEvent } from "@/modules/events/testUtils";
import type { EventOperationsBriefModelOutput } from "@/modules/ai/types";

const NOW = new Date(2026, 5, 15, 12, 0);

function baseModelOutput(overrides: Partial<EventOperationsBriefModelOutput> = {}): EventOperationsBriefModelOutput {
  return {
    executiveSummary: "Event is on track.",
    healthExplanation: "Health is ready at 100/100.",
    riskExplanations: [],
    recommendedActions: [{ label: "Do a thing", reason: "Because.", actionTargetType: null }],
    preparationNotes: null,
    internalNotes: null,
    ...overrides,
  };
}

describe("assembleEventOperationsBrief", () => {
  it("passes narrative fields through unchanged", () => {
    const context = buildEventOperationsBriefContext(makeEvent({ id: "event_1" }), null, [], [], NOW);
    const brief = assembleEventOperationsBrief(baseModelOutput({ preparationNotes: "Confirm the venue." }), context);
    expect(brief.executiveSummary).toBe("Event is on track.");
    expect(brief.preparationNotes).toBe("Confirm the venue.");
  });

  it("assigns a stable, code-generated id to every recommended action, never one from the model", () => {
    const context = buildEventOperationsBriefContext(makeEvent({ id: "event_1" }), null, [], [], NOW);
    const brief = assembleEventOperationsBrief(
      baseModelOutput({
        recommendedActions: [
          { label: "First", reason: "r1", actionTargetType: null },
          { label: "Second", reason: "r2", actionTargetType: null },
        ],
      }),
      context,
    );
    expect(brief.recommendedActions[0].id).toBe("action-0");
    expect(brief.recommendedActions[1].id).toBe("action-1");
  });

  it("resolves actionTargetType to a real, hardcoded destination for this Event", () => {
    const context = buildEventOperationsBriefContext(makeEvent({ id: "event_42" }), null, [], [], NOW);
    const brief = assembleEventOperationsBrief(
      baseModelOutput({ recommendedActions: [{ label: "Review checklist", reason: "r", actionTargetType: "checklist" }] }),
      context,
    );
    expect(brief.recommendedActions[0].actionTarget).toEqual({
      type: "checklist",
      href: "/events/event_42/checklist",
      label: "Open Checklist",
    });
  });

  it("leaves actionTarget null when the model supplies none", () => {
    const context = buildEventOperationsBriefContext(makeEvent({ id: "event_1" }), null, [], [], NOW);
    const brief = assembleEventOperationsBrief(baseModelOutput(), context);
    expect(brief.recommendedActions[0].actionTarget).toBeNull();
  });

  it("pairs a model explanation with its matching detected risk by kind", () => {
    const event = makeEvent({ id: "event_1", assigned_owner: null });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);
    const brief = assembleEventOperationsBrief(
      baseModelOutput({ riskExplanations: [{ kind: "missing_owner", explanation: "No one is responsible for this yet." }] }),
      context,
    );
    const explained = brief.riskExplanations.find((r) => r.risk.kind === "missing_owner");
    expect(explained?.explanation).toBe("No one is responsible for this yet.");
  });

  it("discards a model explanation whose kind matches no real detected risk", () => {
    const context = buildEventOperationsBriefContext(makeEvent({ id: "event_1" }), null, [], [], NOW);
    const brief = assembleEventOperationsBrief(
      baseModelOutput({ riskExplanations: [{ kind: "an_invented_risk", explanation: "Scary!" }] }),
      context,
    );
    expect(brief.riskExplanations.some((r) => r.risk.kind === "an_invented_risk")).toBe(false);
  });

  it("still explains every real detected risk even when the model omits it, falling back to deterministic evidence", () => {
    const event = makeEvent({ id: "event_1", assigned_owner: null });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);
    const brief = assembleEventOperationsBrief(baseModelOutput({ riskExplanations: [] }), context);

    const missingOwnerRisk = context.detectedRisks.find((r) => r.kind === "missing_owner");
    const explained = brief.riskExplanations.find((r) => r.risk.kind === "missing_owner");
    expect(explained).toBeDefined();
    expect(explained?.explanation).toBe(missingOwnerRisk?.evidence);
  });

  it("produces exactly one riskExplanation per detected risk — never more, never fewer", () => {
    const event = makeEvent({ id: "event_1", assigned_owner: null, location_name: null, address: null, budget_min: null, budget_max: null });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);
    const brief = assembleEventOperationsBrief(baseModelOutput({ riskExplanations: [] }), context);
    expect(brief.riskExplanations).toHaveLength(context.detectedRisks.length);
  });
});
