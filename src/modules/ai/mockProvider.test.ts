import { describe, expect, it } from "vitest";
import { makeEvent, makeChecklistItem } from "@/modules/events/testUtils";
import { buildEventOperationsBriefContext } from "@/modules/ai/contextBuilder";
import { createMockAIProvider } from "@/modules/ai/mockProvider";
import { eventOperationsBriefModelOutputSchema } from "@/modules/ai/schema";
import type { AICompletionRequest } from "@/core/ai/types";

const NOW = new Date(2026, 5, 15, 12, 0);

function requestFor(context: ReturnType<typeof buildEventOperationsBriefContext>): AICompletionRequest {
  const now = new Date().toISOString();
  return {
    conversation: {
      id: "conv_1",
      workspaceId: "ws_1",
      context: { workspaceId: "ws_1", ownerType: "event", ownerId: context.event.id, facts: { eventOperationsBriefContext: context } },
      messages: [],
      createdAt: now,
      updatedAt: now,
    },
    prompt: { role: "user", content: "generate" },
  };
}

describe("createMockAIProvider", () => {
  it("is identified as the mock provider", () => {
    expect(createMockAIProvider().name).toBe("mock");
  });

  it("produces content that satisfies the real structured-output schema", async () => {
    const context = buildEventOperationsBriefContext(makeEvent(), null, [], [], NOW);
    const completion = await createMockAIProvider().complete(requestFor(context));
    const parsed = JSON.parse(completion.content);
    expect(eventOperationsBriefModelOutputSchema.safeParse(parsed).success).toBe(true);
    expect(completion.requiresApproval).toBe(true);
    expect(completion.finishReason).toBe("stop");
  });

  it("reflects the current lifecycle stage and health status in the executive summary, not a fixed string", async () => {
    const draft = buildEventOperationsBriefContext(makeEvent({ title: "Draft Event", status: "draft" }), null, [], [], NOW);
    const confirmed = buildEventOperationsBriefContext(
      makeEvent({ title: "Confirmed Event", status: "confirmed", location_name: "Beach", budget_min: 1000 }),
      null,
      [],
      [],
      NOW,
    );

    const draftContent = JSON.parse((await createMockAIProvider().complete(requestFor(draft))).content);
    const confirmedContent = JSON.parse((await createMockAIProvider().complete(requestFor(confirmed))).content);

    expect(draftContent.executiveSummary).toContain("Draft Event");
    expect(confirmedContent.executiveSummary).toContain("Confirmed Event");
    expect(draftContent.executiveSummary).not.toBe(confirmedContent.executiveSummary);
  });

  it("surfaces overdue checklist items in both the executive summary and recommended actions", async () => {
    const overdueItem = makeChecklistItem({ title: "Send contract", status: "pending", due_date: "2020-01-01" });
    const context = buildEventOperationsBriefContext(makeEvent(), null, [overdueItem], [], NOW);
    const completion = await createMockAIProvider().complete(requestFor(context));
    const parsed = JSON.parse(completion.content);

    expect(parsed.executiveSummary).toMatch(/overdue/i);
    expect(
      parsed.recommendedActions.some((action: { label: string }) => action.label.includes("Send contract")),
    ).toBe(true);
  });

  it("explains the existing Health Score/status without inventing a different one", async () => {
    const event = makeEvent({ location_name: null, address: null, budget_min: null, budget_max: null });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);
    const completion = await createMockAIProvider().complete(requestFor(context));
    const parsed = JSON.parse(completion.content);

    expect(parsed.healthExplanation).toContain(String(context.health.score));
    expect(parsed.healthExplanation).toContain(context.health.status);
  });

  it("returns one risk explanation per detected risk, using the same kind", async () => {
    const event = makeEvent({ assigned_owner: null });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);
    const completion = await createMockAIProvider().complete(requestFor(context));
    const parsed = JSON.parse(completion.content);

    const detectedKinds = context.detectedRisks.map((risk) => risk.kind).sort();
    const explainedKinds = parsed.riskExplanations.map((entry: { kind: string }) => entry.kind).sort();
    expect(explainedKinds).toEqual(detectedKinds);
  });

  it("every recommended action includes a non-empty reason", async () => {
    const context = buildEventOperationsBriefContext(makeEvent(), null, [], [], NOW);
    const completion = await createMockAIProvider().complete(requestFor(context));
    const parsed = JSON.parse(completion.content);

    expect(parsed.recommendedActions.length).toBeGreaterThan(0);
    for (const action of parsed.recommendedActions) {
      expect(typeof action.reason).toBe("string");
      expect(action.reason.length).toBeGreaterThan(0);
    }
  });

  it("falls back to a safe error result when no context is supplied", async () => {
    const now = new Date().toISOString();
    const completion = await createMockAIProvider().complete({
      conversation: {
        id: "conv_1",
        workspaceId: "ws_1",
        context: { workspaceId: "ws_1", facts: {} },
        messages: [],
        createdAt: now,
        updatedAt: now,
      },
      prompt: { role: "user", content: "generate" },
    });
    expect(completion.finishReason).toBe("error");
  });

  it("is not registered as the active provider merely by being constructed", async () => {
    const { isAIConfigured } = await import("@/core/ai");
    createMockAIProvider();
    expect(isAIConfigured()).toBe(false);
  });
});
