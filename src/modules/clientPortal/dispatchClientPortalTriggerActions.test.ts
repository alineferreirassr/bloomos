import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/automation/resolver", () => ({
  dispatchAutomationTrigger: vi.fn(),
}));
vi.mock("@/modules/automation/registerAutomationDefinitions", () => ({
  registerAutomationDefinitions: vi.fn(),
}));

import {
  dispatchChecklistItemCompletedTrigger,
  dispatchDocumentDownloadedTrigger,
  dispatchProposalViewedTrigger,
} from "@/modules/clientPortal/dispatchClientPortalTriggerActions";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import { readClientAccounts, writeClientAccounts, resetClientAccountsStore, MOCK_CURRENT_CLIENT_ACCOUNT_ID } from "@/lib/data/mock/clientAccountsStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/** Mock mode has no real Client Portal auth — the seeded `MOCK_CURRENT_CLIENT_ACCOUNT_ID` account stands in for "the current client," matching `getClientPortalContract.test.ts`'s own precedent. */
function pointCurrentClientAccountAt(clientId: string): void {
  const accounts = readClientAccounts();
  writeClientAccounts(accounts.map((a) => (a.id === MOCK_CURRENT_CLIENT_ACCOUNT_ID ? { ...a, client_id: clientId, workspace_id: CURRENT_WORKSPACE_ID, status: "active" as const } : a)));
}

beforeEach(() => {
  resetClientAccountsStore();
  pointCurrentClientAccountAt("client_1");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("dispatchClientPortalTriggerActions (v2 Checkpoint 45 security fix)", () => {
  it("Step 10: dispatches checklist_item.completed with the caller's own resolved workspace/client, never a caller-supplied one", async () => {
    await dispatchChecklistItemCompletedTrigger("item_1", "Sign the contract");

    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "checklist_item.completed",
        workspaceId: CURRENT_WORKSPACE_ID,
        actorMemberId: null,
        facts: { clientId: "client_1", checklistItemId: "item_1", checklistItemTitle: "Sign the contract" },
      }),
      expect.objectContaining({ permissions: [] }),
    );
  });

  it("Step 10: dispatches document.downloaded with the resolved client-safe facts", async () => {
    await dispatchDocumentDownloadedTrigger("doc_1");

    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ type: "document.downloaded", workspaceId: CURRENT_WORKSPACE_ID, facts: { clientId: "client_1", documentId: "doc_1" } }),
      expect.anything(),
    );
  });

  it("Step 10: dispatches proposal.viewed with the resolved client-safe facts", async () => {
    await dispatchProposalViewedTrigger("proposal_1");

    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ type: "proposal.viewed", workspaceId: CURRENT_WORKSPACE_ID, facts: { clientId: "client_1", proposalId: "proposal_1" } }),
      expect.anything(),
    );
  });

  it("no-ops without throwing when there is no resolvable client account context", async () => {
    writeClientAccounts(readClientAccounts().filter((a) => a.id !== MOCK_CURRENT_CLIENT_ACCOUNT_ID));
    await expect(dispatchDocumentDownloadedTrigger("doc_1")).resolves.toBeUndefined();
    expect(dispatchAutomationTrigger).not.toHaveBeenCalled();
  });

  it("never lets a dispatch failure throw back into the caller — the Client Portal action that triggered it must still succeed", async () => {
    vi.mocked(dispatchAutomationTrigger).mockRejectedValueOnce(new Error("boom"));
    await expect(dispatchDocumentDownloadedTrigger("doc_1")).resolves.toBeUndefined();
  });
});
