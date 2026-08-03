import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { registerAutomationActions } from "@/modules/automation/registerAutomationActions";
import { getAutomationAction, listAutomationActions } from "@/core/automation/actionRegistry";
import { runSkillFallbackActionId } from "@/modules/automation/actions/runSkillActionFactory";
import { GENERATE_PROPOSAL_ACTION_ID } from "@/modules/automation/actions/generateProposalAction";
import { PROPOSAL_SKILL_ID } from "@/modules/ai/proposal/registerProposalSkill";

registerAutomationActions();

describe("registerAutomationActions — Checkpoint 13's own Skill fallback loop", () => {
  it("registers the 14 pre-existing bespoke Actions plus one generic fallback per uncovered, runnable Skill", () => {
    // 14 bespoke (Step 5's 9 + Checkpoint 12's 5 document actions) + at least 2 generic fallbacks (Browse AI Memory, Event Operations Brief) — never the "document-assistant" Coming Soon placeholder.
    expect(listAutomationActions().length).toBeGreaterThanOrEqual(16);
  });

  it("never double-registers a fallback for a Skill that already has a bespoke Action", () => {
    // GENERATE_PROPOSAL_ACTION_ID is the one, real, bespoke action for the Proposal Generator Skill — the fallback id for that same skill must not also exist.
    expect(getAutomationAction(GENERATE_PROPOSAL_ACTION_ID)).toBeDefined();
    expect(getAutomationAction(runSkillFallbackActionId(PROPOSAL_SKILL_ID))).toBeUndefined();
  });

  it("registers a real, working generic fallback Action for Browse AI Memory", () => {
    const action = getAutomationAction(runSkillFallbackActionId("browse-ai-memory"));
    expect(action).toBeDefined();
    expect(action?.name).toBe("Browse AI Memory");
  });

  it("is idempotent — calling it again never duplicates or errors", () => {
    const before = listAutomationActions().length;
    registerAutomationActions();
    expect(listAutomationActions().length).toBe(before);
  });
});
