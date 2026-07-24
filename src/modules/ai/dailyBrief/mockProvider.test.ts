import { describe, expect, it } from "vitest";
import { makeEvent } from "@/modules/events/testUtils";
import { buildEventOperationsBriefContext } from "@/modules/ai/contextBuilder";
import { buildDailyOperationsBriefContext } from "@/modules/ai/dailyBrief/contextBuilder";
import { createDailyOperationsBriefMockProvider } from "@/modules/ai/dailyBrief/mockProvider";
import { dailyOperationsBriefModelOutputSchema } from "@/modules/ai/dailyBrief/schema";
import type { AICompletionRequest } from "@/core/ai/types";
import type { DailyOperationsBriefContext } from "@/modules/ai/dailyBrief/types";

const NOW = new Date(2026, 5, 15, 12, 0);

function requestFor(context: DailyOperationsBriefContext): AICompletionRequest {
  const now = new Date().toISOString();
  return {
    conversation: {
      id: "conv_1",
      workspaceId: "ws_1",
      context: { workspaceId: "ws_1", facts: { dailyOperationsBriefContext: context } },
      messages: [],
      createdAt: now,
      updatedAt: now,
    },
    prompt: { role: "user", content: "generate" },
  };
}

describe("createDailyOperationsBriefMockProvider", () => {
  it("produces content that satisfies the real structured-output schema", async () => {
    const eventContext = buildEventOperationsBriefContext(makeEvent({ id: "e1" }), null, [], [], NOW);
    const context = buildDailyOperationsBriefContext([eventContext], NOW);
    const completion = await createDailyOperationsBriefMockProvider().complete(requestFor(context));
    const parsed = JSON.parse(completion.content);
    expect(dailyOperationsBriefModelOutputSchema.safeParse(parsed).success).toBe(true);
  });

  it("only references real Event ids that are actually at risk", async () => {
    const atRisk = buildEventOperationsBriefContext(makeEvent({ id: "risky", assigned_owner: null }), null, [], [], NOW);
    const context = buildDailyOperationsBriefContext([atRisk], NOW);
    const completion = await createDailyOperationsBriefMockProvider().complete(requestFor(context));
    const parsed = JSON.parse(completion.content);
    expect(parsed.eventNotes.every((n: { eventId: string }) => n.eventId === "risky")).toBe(true);
  });

  it("falls back to a safe error result when no context is supplied", async () => {
    const now = new Date().toISOString();
    const completion = await createDailyOperationsBriefMockProvider().complete({
      conversation: { id: "conv_1", workspaceId: "ws_1", context: { workspaceId: "ws_1", facts: {} }, messages: [], createdAt: now, updatedAt: now },
      prompt: { role: "user", content: "generate" },
    });
    expect(completion.finishReason).toBe("error");
  });
});
