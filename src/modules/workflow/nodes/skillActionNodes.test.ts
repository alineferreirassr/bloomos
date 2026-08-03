import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { buildSkillActionNodes } from "@/modules/workflow/nodes/skillActionNodes";
import { PROPOSAL_SKILL_ID } from "@/modules/ai/proposal/registerProposalSkill";
import { DAILY_OPERATIONS_BRIEF_SKILL_ID } from "@/modules/ai/dailyBrief/registerDailyOperationsBriefSkill";
import { CRM_ASSISTANT_SKILL_ID } from "@/modules/ai/crmAssistant/registerCRMAssistantSkill";
import { FINANCE_ASSISTANT_SKILL_ID } from "@/modules/ai/financeAssistant/registerFinanceAssistantSkill";
import { GENERATE_PROPOSAL_ACTION_ID } from "@/modules/automation/actions/generateProposalAction";
import { GENERATE_DAILY_BRIEF_ACTION_ID } from "@/modules/automation/actions/generateDailyBriefAction";
import { GENERATE_CRM_REPORT_ACTION_ID } from "@/modules/automation/actions/generateCrmReportAction";
import { GENERATE_FINANCE_REPORT_ACTION_ID } from "@/modules/automation/actions/generateFinanceReportAction";
import { runSkillFallbackActionId } from "@/modules/automation/actions/runSkillActionFactory";

describe("buildSkillActionNodes — Step 9's generic Skill discovery", () => {
  it("generates one Action node per real, runnable Skill — never a hardcoded 4", () => {
    const nodes = buildSkillActionNodes();
    // At least the 4 known Skills, plus Browse AI Memory and Event Operations Brief — never the "document-assistant" Coming Soon placeholder (no `execute`).
    expect(nodes.length).toBeGreaterThanOrEqual(6);
    expect(nodes.every((node) => node.kind === "action" && node.category === "action")).toBe(true);
    expect(nodes.some((node) => node.id === "action.run-skill.document-assistant")).toBe(false);
  });

  it("routes each of the 4 known Skills to its own existing bespoke Automation Action, not the generic fallback", () => {
    const nodes = buildSkillActionNodes();
    const byId = new Map(nodes.map((node) => [node.id, node]));
    expect(byId.get(`action.run-skill.${PROPOSAL_SKILL_ID}`)?.compileTarget).toBe(GENERATE_PROPOSAL_ACTION_ID);
    expect(byId.get(`action.run-skill.${DAILY_OPERATIONS_BRIEF_SKILL_ID}`)?.compileTarget).toBe(GENERATE_DAILY_BRIEF_ACTION_ID);
    expect(byId.get(`action.run-skill.${CRM_ASSISTANT_SKILL_ID}`)?.compileTarget).toBe(GENERATE_CRM_REPORT_ACTION_ID);
    expect(byId.get(`action.run-skill.${FINANCE_ASSISTANT_SKILL_ID}`)?.compileTarget).toBe(GENERATE_FINANCE_REPORT_ACTION_ID);
  });

  it("routes any other real Skill (e.g. Browse AI Memory) to the generic fallback Action id", () => {
    const nodes = buildSkillActionNodes();
    const browseMemory = nodes.find((node) => node.name === "Browse AI Memory");
    expect(browseMemory).toBeDefined();
    expect(browseMemory?.compileTarget).toBe(runSkillFallbackActionId("browse-ai-memory"));
  });

  it("is idempotent to call twice — the underlying Skill Registry's own registration guards make repeat calls safe", () => {
    const first = buildSkillActionNodes();
    const second = buildSkillActionNodes();
    expect(second.map((node) => node.id).sort()).toEqual(first.map((node) => node.id).sort());
  });
});
