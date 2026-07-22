import { describe, expect, it, vi } from "vitest";
import { makeLead } from "@/modules/leads/testUtils";
import { buildQuickActions, type QuickActionHandlers } from "@/modules/pipeline/quickActions";

function makeHandlers(overrides: Partial<QuickActionHandlers> = {}): QuickActionHandlers {
  return {
    can: () => true,
    onOpen: vi.fn(),
    onAssignTeam: vi.fn(),
    onScheduleConsultation: vi.fn(),
    onSendProposal: vi.fn(),
    onMoveToWaitingDecision: vi.fn(),
    onMarkLost: vi.fn(),
    onArchive: vi.fn(),
    onBookLead: vi.fn(),
    ...overrides,
  };
}

describe("buildQuickActions", () => {
  it("always includes Open Lead regardless of permissions", () => {
    const actions = buildQuickActions(makeLead({ status: "new" }), makeHandlers({ can: () => false }));
    expect(actions.map((a) => a.label)).toEqual(["Open Lead"]);
  });

  it("includes every update-gated action for a working-status Lead when leads.update is granted", () => {
    const actions = buildQuickActions(
      makeLead({ status: "new" }),
      makeHandlers({ can: (p) => p === "leads.update" }),
    );
    expect(actions.map((a) => a.label)).toEqual([
      "Open Lead",
      "Assign Team",
      "Schedule Consultation",
      "Send Proposal",
      "Move to Waiting Decision",
      "Mark Lost",
    ]);
  });

  it("omits Schedule Consultation / Send Proposal / Move to Waiting Decision when the Lead is already at that stage", () => {
    const actions = buildQuickActions(
      makeLead({ status: "waiting_decision" }),
      makeHandlers({ can: (p) => p === "leads.update" }),
    );
    expect(actions.map((a) => a.label)).not.toContain("Move to Waiting Decision");
    expect(actions.map((a) => a.label)).toContain("Schedule Consultation");
    expect(actions.map((a) => a.label)).toContain("Send Proposal");
  });

  it("includes Archive only when leads.archive is granted, independent of leads.update", () => {
    const actions = buildQuickActions(
      makeLead({ status: "new" }),
      makeHandlers({ can: (p) => p === "leads.archive" }),
    );
    expect(actions.map((a) => a.label)).toEqual(["Open Lead", "Archive"]);
  });

  it("includes Book Lead only when both leads.update and events.create are granted", () => {
    const onlyLeadsUpdate = buildQuickActions(
      makeLead({ status: "waiting_decision" }),
      makeHandlers({ can: (p) => p === "leads.update" }),
    );
    expect(onlyLeadsUpdate.map((a) => a.label)).not.toContain("Book Lead");

    const both = buildQuickActions(
      makeLead({ status: "waiting_decision" }),
      makeHandlers({ can: (p) => p === "leads.update" || p === "events.create" }),
    );
    expect(both.map((a) => a.label)).toContain("Book Lead");
  });

  it("shows only Open Lead for a terminal-status Lead (converted/lost/archived), even with every permission granted", () => {
    for (const status of ["converted", "lost", "archived"] as const) {
      const actions = buildQuickActions(makeLead({ status }), makeHandlers());
      expect(actions.map((a) => a.label)).toEqual(["Open Lead"]);
    }
  });

  it("shows nothing beyond Open Lead when no permission is granted", () => {
    const actions = buildQuickActions(makeLead({ status: "qualified" }), makeHandlers({ can: () => false }));
    expect(actions.map((a) => a.label)).toEqual(["Open Lead"]);
  });

  it("wires each action's onSelect to the corresponding handler", () => {
    const handlers = makeHandlers({ can: () => true });
    const actions = buildQuickActions(makeLead({ status: "new" }), handlers);
    actions.find((a) => a.label === "Assign Team")?.onSelect();
    expect(handlers.onAssignTeam).toHaveBeenCalledTimes(1);
    actions.find((a) => a.label === "Book Lead")?.onSelect();
    expect(handlers.onBookLead).toHaveBeenCalledTimes(1);
  });
});
