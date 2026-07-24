import { describe, expect, it } from "vitest";
import { makeEvent } from "@/modules/events/testUtils";
import { buildEventOperationsBriefContext } from "@/modules/ai/contextBuilder";
import { buildDailyOperationsBriefContext } from "@/modules/ai/dailyBrief/contextBuilder";
import { assembleDailyOperationsBrief } from "@/modules/ai/dailyBrief/assembleBrief";

const NOW = new Date(2026, 5, 15, 12, 0);

describe("assembleDailyOperationsBrief", () => {
  it("passes overview and topPriorities through unchanged", () => {
    const eventContext = buildEventOperationsBriefContext(makeEvent({ id: "e1" }), null, [], [], NOW);
    const context = buildDailyOperationsBriefContext([eventContext], NOW);
    const brief = assembleDailyOperationsBrief({ overview: "All clear.", topPriorities: ["Nothing urgent"], eventNotes: [] }, context);
    expect(brief.overview).toBe("All clear.");
    expect(brief.topPriorities).toEqual(["Nothing urgent"]);
  });

  it("pairs an event note with the real Event it references", () => {
    const eventContext = buildEventOperationsBriefContext(makeEvent({ id: "e1", title: "Beachfront Proposal" }), null, [], [], NOW);
    const context = buildDailyOperationsBriefContext([eventContext], NOW);
    const brief = assembleDailyOperationsBrief(
      { overview: "x", topPriorities: ["x"], eventNotes: [{ eventId: "e1", note: "Checklist is overdue." }] },
      context,
    );
    expect(brief.eventNotes[0].event.title).toBe("Beachfront Proposal");
    expect(brief.eventNotes[0].note).toBe("Checklist is overdue.");
  });

  it("discards an event note referencing an Event id not actually present in context", () => {
    const eventContext = buildEventOperationsBriefContext(makeEvent({ id: "e1" }), null, [], [], NOW);
    const context = buildDailyOperationsBriefContext([eventContext], NOW);
    const brief = assembleDailyOperationsBrief(
      { overview: "x", topPriorities: ["x"], eventNotes: [{ eventId: "an_invented_event_id", note: "Scary!" }] },
      context,
    );
    expect(brief.eventNotes).toHaveLength(0);
  });
});
