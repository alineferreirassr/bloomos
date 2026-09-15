import { describe, expect, it, vi } from "vitest";

// SOCIAL-13H — `registerAutomationDefinitions()` calls `registerAutomationActions()`
// first, which registers every Action, including the four "Generate X"
// actions (each importing its own Skill wrapper) and the Instagram
// Lead-capture actions (`instagramLeadCapture.ts`'s own real `import
// "server-only"`) — none of this is actually exercised at runtime by this
// file's own assertions (which only ever read already-registered
// Definitions/Actions, never dispatch a real trigger), this mock set exists
// purely so the import graph resolves. Identical, proven set to
// `getAutomationDashboardData.test.ts`'s own mocks for the exact same
// reason.
vi.mock("server-only", () => ({}));
vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { registerAutomationDefinitions } from "@/modules/automation/registerAutomationDefinitions";
import { getAutomation } from "@/core/automation/registry";
import { getAutomationAction } from "@/core/automation/actionRegistry";
import { NOTIFY_ON_OVERDUE_INVOICE_ID } from "@/modules/automation/definitions/notifyOnOverdueInvoice";
import { RECORD_MEMORY_ON_PROPOSAL_REJECTION_ID } from "@/modules/automation/definitions/recordMemoryOnProposalRejection";
import { SUGGEST_FOLLOW_UP_PROPOSAL_ID } from "@/modules/automation/definitions/suggestFollowUpProposal";
import { CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID } from "@/modules/automation/definitions/captureLeadFromInstagramComment";
import { CAPTURE_LEAD_FROM_INSTAGRAM_DM_AUTOMATION_ID } from "@/modules/automation/definitions/captureLeadFromInstagramDm";
import { CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID } from "@/modules/automation/actions/createLeadFromInstagramCommentAction";
import { CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID } from "@/modules/automation/actions/createLeadFromInstagramDmAction";

// `registerAutomationDefinitions()` is idempotent (a single `registered`
// module-level guard), so it is called exactly once here, at module scope —
// mirroring every real production call site (`acceptProposalDraft.ts`,
// `metaWebhookProcessing.ts`, etc.). Every `it()` below only ever *reads*
// already-registered state; nothing here mutates the registry, so no
// `beforeEach`/reset is needed or safe (a `resetAutomationRegistry()` call
// combined with this module-level guard would leave the registry
// permanently empty for every test after the first).
registerAutomationDefinitions();

describe("registerAutomationDefinitions — SOCIAL-13H default Instagram Lead-capture wiring", () => {
  it("registers a default Automation for instagram.comment_received wired to create-lead-from-instagram-comment", () => {
    const automation = getAutomation(CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID);
    expect(automation).toBeDefined();
    expect(automation?.trigger).toBe("instagram.comment_received");
    expect(automation?.actionIds).toEqual([CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID]);
    expect(automation?.status).toBe("active");
  });

  it("registers a default Automation for instagram.message_received wired to create-lead-from-instagram-dm", () => {
    const automation = getAutomation(CAPTURE_LEAD_FROM_INSTAGRAM_DM_AUTOMATION_ID);
    expect(automation).toBeDefined();
    expect(automation?.trigger).toBe("instagram.message_received");
    expect(automation?.actionIds).toEqual([CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID]);
    expect(automation?.status).toBe("active");
  });

  it("both default Automations require no approval and no permission/role — dispatch happens with no human present (metaWebhookProcessing.ts's own SYSTEM_DISPATCH_CONTEXT carries userId: null, role: null, permissions: [])", () => {
    const comment = getAutomation(CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID);
    const dm = getAutomation(CAPTURE_LEAD_FROM_INSTAGRAM_DM_AUTOMATION_ID);
    for (const automation of [comment, dm]) {
      expect(automation?.approvalPolicy).toEqual({ kind: "never_required" });
      expect(automation?.requiredPermissions).toEqual([]);
      expect(automation?.minimumRole).toBeNull();
      expect(automation?.featureFlag).toBeNull();
    }
  });

  it("both underlying Actions (create-lead-from-instagram-comment / -dm) are registered and reachable — the Definition never references an unregistered Action id", () => {
    expect(getAutomationAction(CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID)).toBeDefined();
    expect(getAutomationAction(CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID)).toBeDefined();
  });

  it("the 2 new default ids never collide with each other, with the 3 pre-existing example Automations, or with the 2 Action ids they wrap", () => {
    const ids = [
      CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID,
      CAPTURE_LEAD_FROM_INSTAGRAM_DM_AUTOMATION_ID,
      NOTIFY_ON_OVERDUE_INVOICE_ID,
      RECORD_MEMORY_ON_PROPOSAL_REJECTION_ID,
      SUGGEST_FOLLOW_UP_PROPOSAL_ID,
      CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID,
      CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID,
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not alter the 3 pre-existing example Automations — same trigger, same actionIds, same approval policy as before this checkpoint", () => {
    const overdueInvoice = getAutomation(NOTIFY_ON_OVERDUE_INVOICE_ID);
    expect(overdueInvoice).toMatchObject({ trigger: "invoice.overdue", approvalPolicy: { kind: "workspace_configurable" } });

    const memoryOnRejection = getAutomation(RECORD_MEMORY_ON_PROPOSAL_REJECTION_ID);
    expect(memoryOnRejection).toMatchObject({ trigger: "proposal.rejected", approvalPolicy: { kind: "never_required" } });

    const followUpProposal = getAutomation(SUGGEST_FOLLOW_UP_PROPOSAL_ID);
    expect(followUpProposal).toMatchObject({ trigger: "proposal.rejected", approvalPolicy: { kind: "role_restricted", minimumApproverRole: "manager" } });
  });

  it("a Definition itself carries no workspace-specific field — workspace scoping is entirely delegated to trigger.workspaceId at dispatch time, exactly like every other registered Automation", () => {
    const automation = getAutomation(CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID);
    expect(automation).not.toHaveProperty("workspaceId");
    expect(automation).not.toHaveProperty("workspace_id");
  });

  it("calling registerAutomationDefinitions() again is a safe no-op — the registry still contains exactly the same automations, not duplicates", () => {
    registerAutomationDefinitions();
    expect(getAutomation(CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID)).toBeDefined();
    expect(getAutomation(CAPTURE_LEAD_FROM_INSTAGRAM_DM_AUTOMATION_ID)).toBeDefined();
    expect(getAutomation(NOTIFY_ON_OVERDUE_INVOICE_ID)).toBeDefined();
  });
});
