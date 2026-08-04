import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
// This module transitively imports @/modules/clientJourney/clientJourneyActions,
// which now imports @/lib/auth/workspaceSession, which transitively imports the
// server-only-gated @/lib/supabase/server. Mock it out so that import doesn't
// throw in this non-Server-Component test environment.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createContract, resetAllMockData } from "@/lib/data";
import { getClientPortalContractDocumentAction, compareClientPortalContractVersionsAction, listClientPortalContractsAction } from "@/modules/clientPortal/getClientPortalContract";
import { createContractVersionAction, publishContractVersionAction } from "@/modules/contractPlatform/contractPlatformActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetContractBuilderTemplatesStore } from "@/lib/data/mock/contractBuilderTemplatesStore";
import { resetContractClausesStore } from "@/lib/data/mock/contractClausesStore";
import { resetContractBuilderStore } from "@/lib/data/mock/contractBuilderStore";
import { resetContractCache } from "@/core/contractPlatform/contractCache";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { readClientAccounts, writeClientAccounts, resetClientAccountsStore, MOCK_CURRENT_CLIENT_ACCOUNT_ID } from "@/lib/data/mock/clientAccountsStore";
import type { ContractInput } from "@/modules/contracts/schema";
import type { CreateContractVersionInput } from "@/types/contractPlatform";

const memberSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["contract_builder.view", "contract_builder.manage", "contract_versions.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetAllMockData();
  resetContractBuilderTemplatesStore();
  resetContractClausesStore();
  resetContractBuilderStore();
  resetContractCache();
}

function contractInput(overrides: Partial<ContractInput> = {}): ContractInput {
  return {
    client_id: "client_2",
    event_id: "event_1",
    template_id: null,
    title: "Test Portal Contract",
    description: null,
    effective_date: null,
    expiration_date: null,
    total_value: 5000,
    deposit_required: true,
    deposit_amount: 1500,
    currency: "USD",
    notes: null,
    ...overrides,
  };
}

function versionInput(overrides: Partial<CreateContractVersionInput> = {}): CreateContractVersionInput {
  return {
    builderTemplateId: null,
    builderTemplateKey: "master_service_agreement",
    header: { title: "Master Service Agreement", subtitle: null, logoAssetId: null },
    sections: [{ id: "sec_1", key: "parties", title: "Parties", isCustom: false, blocks: [{ id: "blk_1", type: "paragraph", order: 0, heading: null, text: "Parties to this agreement, {{client_name}}.", variableKeys: [], clauseId: null, mediaAssetIds: [], tableRows: [], attachmentIds: [], placeholderLabel: null }] }],
    clauseIds: [],
    terms: "Standard terms.",
    policies: "Standard policy.",
    footer: { text: "Thank you.", contactEmail: null, contactPhone: null },
    notes: null,
    reason: null,
    ...overrides,
  };
}

/** Mock mode has no real Client Portal auth — the seeded `MOCK_CURRENT_CLIENT_ACCOUNT_ID` account stands in for "the current client," matching `getClientPortalProposal.test.ts`'s own precedent. */
function pointCurrentClientAccountAt(clientId: string): void {
  const accounts = readClientAccounts();
  writeClientAccounts(accounts.map((a) => (a.id === MOCK_CURRENT_CLIENT_ACCOUNT_ID ? { ...a, client_id: clientId, workspace_id: CURRENT_WORKSPACE_ID, status: "active" as const } : a)));
}

async function makePublishedContract(): Promise<{ contractId: string; clientId: string }> {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(memberSession);
  const created = await createContract(contractInput());
  if (!created.success) throw new Error(`setup failed: createContract — ${JSON.stringify(created.error)}`);
  await createContractVersionAction(created.data.id, versionInput());
  await publishContractVersionAction(created.data.id);
  return { contractId: created.data.id, clientId: created.data.client_id };
}

beforeEach(() => {
  resetAll();
  resetClientAccountsStore();
});

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
});

describe("getClientPortalContractDocumentAction", () => {
  it("rejects when the current client account has no matching contract", async () => {
    pointCurrentClientAccountAt("client_with_nothing");
    const result = await getClientPortalContractDocumentAction("contract_nonexistent");
    expect(result.success).toBe(false);
  });

  it("rejects a contract belonging to a different client", async () => {
    const { contractId } = await makePublishedContract();
    pointCurrentClientAccountAt("client_someone_else");
    const result = await getClientPortalContractDocumentAction(contractId);
    expect(result.success).toBe(false);
  });

  it("rejects a document that has not been published yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(memberSession);
    const created = await createContract(contractInput());
    if (!created.success) throw new Error("setup failed");
    await createContractVersionAction(created.data.id, versionInput());
    pointCurrentClientAccountAt(created.data.client_id);
    const result = await getClientPortalContractDocumentAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("returns the client-safe, variable-substituted document for a published contract", async () => {
    const { contractId, clientId } = await makePublishedContract();
    pointCurrentClientAccountAt(clientId);
    const result = await getClientPortalContractDocumentAction(contractId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentVersionNumber).toBe(1);
      expect(result.data.documentStatus).toBe("published");
      const block = result.data.sections[0]?.blocks[0];
      expect(block?.text).not.toContain("{{client_name}}");
    }
  });
});

describe("compareClientPortalContractVersionsAction", () => {
  it("compares two versions for the owning client", async () => {
    const { contractId, clientId } = await makePublishedContract();
    // A new version moves the document out of "published" back to "review" —
    // republish so the client-visibility gate (`status === "published"`) still
    // passes, matching the same rule `getClientPortalContractDocumentAction`
    // enforces.
    await createContractVersionAction(contractId, versionInput({ terms: "Different terms." }));
    await publishContractVersionAction(contractId);
    pointCurrentClientAccountAt(clientId);
    const result = await compareClientPortalContractVersionsAction(contractId, 1, 2);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hasChanges).toBe(true);
  });

  it("errors for a nonexistent version", async () => {
    const { contractId, clientId } = await makePublishedContract();
    pointCurrentClientAccountAt(clientId);
    const result = await compareClientPortalContractVersionsAction(contractId, 1, 99);
    expect(result.success).toBe(false);
  });
});

describe("listClientPortalContractsAction", () => {
  it("lists only published contract documents belonging to the current client", async () => {
    const { contractId, clientId } = await makePublishedContract();
    pointCurrentClientAccountAt(clientId);
    const result = await listClientPortalContractsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.some((c) => c.contractId === contractId)).toBe(true);
  });

  it("returns an empty list when nothing has been published yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(memberSession);
    const created = await createContract(contractInput());
    if (!created.success) throw new Error("setup failed");
    pointCurrentClientAccountAt(created.data.client_id);
    const result = await listClientPortalContractsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });
});
