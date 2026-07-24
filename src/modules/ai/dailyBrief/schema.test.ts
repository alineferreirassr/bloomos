import { describe, expect, it } from "vitest";
import { dailyOperationsBriefModelOutputSchema } from "@/modules/ai/dailyBrief/schema";

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    overview: "Two Events need attention today.",
    topPriorities: ["Follow up on the Beachfront Proposal"],
    eventNotes: [{ eventId: "event_1", note: "Checklist is overdue." }],
    ...overrides,
  };
}

describe("dailyOperationsBriefModelOutputSchema", () => {
  it("accepts a well-formed structured output", () => {
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput()).success).toBe(true);
  });

  it("accepts zero event notes", () => {
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ eventNotes: [] })).success).toBe(true);
  });

  it("rejects an empty overview", () => {
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ overview: "" })).success).toBe(false);
  });

  it("rejects zero top priorities", () => {
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ topPriorities: [] })).success).toBe(false);
  });

  it("rejects more than 5 top priorities", () => {
    const result = dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ topPriorities: ["1", "2", "3", "4", "5", "6"] }));
    expect(result.success).toBe(false);
  });

  it("rejects more than 15 event notes", () => {
    const note = { eventId: "event_1", note: "x" };
    const result = dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ eventNotes: Array(16).fill(note) }));
    expect(result.success).toBe(false);
  });

  it("rejects a completely different shape", () => {
    expect(dailyOperationsBriefModelOutputSchema.safeParse("free text response").success).toBe(false);
  });
});
