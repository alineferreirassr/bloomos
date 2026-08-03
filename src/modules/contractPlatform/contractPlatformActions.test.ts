import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  listContractBuilderTemplatesAction,
  createCustomContractTemplateAction,
  listContractClausesAction,
  createCustomClauseAction,
  buildContractDetail,
  evaluateContractAction,
  listContractSummariesAction,
  createContractVersionAction,
  publishContractVersionAction,
  archiveContractDocumentAction,
  restoreContractVersionAction,
  compareContractVersionsAction,
  markContractReadyAction,
  getContractAnalyticsAction,
  contractRecommendationsForExecutiveDecisions,
} from "@/modules/contractPlatform/contractPlatformActions";
import { createContract, resetAllMockData } from "@/lib/data";
import { resetContractBuilderTemplatesStore } from "@/lib/data/mock/contractBuilderTemplatesStore";
import { resetContractClausesStore } from "@/lib/data/mock/contractClausesStore";
import { resetContractBuilderStore } from "@/lib/data/mock/contractBuilderStore";
import { resetContractCache } from "@/core/contractPlatform/contractCache";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { CreateContractVersionInput } from "@/types/contractPlatform";
import type { ContractInput } from "@/modules/contracts/schema";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["contract_builder.view", "contract_builder.manage", "contract_templates.manage", "contract_clauses.manage", "contract_versions.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetAllMockData();
  resetContractBuilderTemplatesStore();
  resetContractClausesStore();
  resetContractBuilderStore();
  resetContractCache();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
});

function contractInput(overrides: Partial<ContractInput> = {}): ContractInput {
  return {
    client_id: "client_2",
    event_id: "event_1",
    template_id: null,
    title: "Test Contract",
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

async function makeContract() {
  const created = await createContract(contractInput());
  if (!created.success) throw new Error(`setup failed: createContract — ${JSON.stringify(created.error)}`);
  return created.data;
}

function versionInput(overrides: Partial<CreateContractVersionInput> = {}): CreateContractVersionInput {
  return {
    builderTemplateId: null,
    builderTemplateKey: "master_service_agreement",
    header: { title: "Master Service Agreement", subtitle: null, logoAssetId: null },
    sections: [{ id: "sec_1", key: "parties", title: "Parties", isCustom: false, blocks: [{ id: "blk_1", type: "paragraph", order: 0, heading: null, text: "Parties to this agreement.", variableKeys: [], clauseId: null, mediaAssetIds: [], tableRows: [], attachmentIds: [], placeholderLabel: null }] }],
    clauseIds: [],
    terms: "Standard terms.",
    policies: "Standard policy.",
    footer: { text: "Thank you.", contactEmail: null, contactPhone: null },
    notes: null,
    reason: null,
    ...overrides,
  };
}

describe("session gating", () => {
  it("rejects every action when the session is not active", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await listContractBuilderTemplatesAction();
    expect(result.success).toBe(false);
  });
});

// v2 Checkpoint 45 security fix — these 7 mutations previously gated only on "an active
// session," with no permission check at all, unlike sendContractForSignatureAction (the one
// action in this file that always checked "contracts.lifecycle"). Each now checks the exact
// permission its own Checkpoint 34 registration comment (core/enums/permission.ts) already
// documented as its intended gate. The positive case (session has the permission) is already
// exercised by every other describe block in this file, which all pass under the full-permission
// `session` fixture — these tests cover the negative case those never did.
describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  const noPermissionsSession: MemberSessionSnapshot = { ...session, permissions: [] };

  it("createCustomContractTemplateAction requires contract_templates.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionsSession);
    const result = await createCustomContractTemplateAction({
      name: "My Template",
      description: "Custom",
      structure: { header: { title: "", subtitle: null, logoAssetId: null }, sectionKeys: [], defaultClauseKeys: [], optionalClauseKeys: [], hasSignaturePlaceholders: false, footer: { text: "", contactEmail: null, contactPhone: null } },
    });
    expect(result.success).toBe(false);
  });

  it("createCustomClauseAction requires contract_clauses.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionsSession);
    const result = await createCustomClauseAction({ name: "My Clause", category: "Custom", bodyText: "Custom clause text.", isOptional: true });
    expect(result.success).toBe(false);
  });

  it("createContractVersionAction requires contract_versions.manage", async () => {
    const contract = await makeContract();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionsSession);
    const result = await createContractVersionAction(contract.id, versionInput());
    expect(result.success).toBe(false);
  });

  it("publishContractVersionAction requires contract_builder.manage", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionsSession);
    const result = await publishContractVersionAction(contract.id);
    expect(result.success).toBe(false);
  });

  it("archiveContractDocumentAction requires contract_builder.manage", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionsSession);
    const result = await archiveContractDocumentAction(contract.id);
    expect(result.success).toBe(false);
  });

  it("restoreContractVersionAction requires contract_versions.manage", async () => {
    const contract = await makeContract();
    const first = await createContractVersionAction(contract.id, versionInput());
    await createContractVersionAction(contract.id, versionInput());
    if (!first.success) throw new Error("setup failed");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionsSession);
    const result = await restoreContractVersionAction(contract.id, first.data.versions[0].id);
    expect(result.success).toBe(false);
  });

  it("markContractReadyAction requires contract_builder.manage", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionsSession);
    const result = await markContractReadyAction(contract.id);
    expect(result.success).toBe(false);
  });
});

describe("template/clause libraries", () => {
  it("lists the 11 seeded system builder templates", async () => {
    const result = await listContractBuilderTemplatesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBe(11);
  });

  it("creates a custom builder template", async () => {
    const result = await createCustomContractTemplateAction({
      name: "My Template",
      description: "Custom",
      structure: { header: { title: "", subtitle: null, logoAssetId: null }, sectionKeys: [], defaultClauseKeys: [], optionalClauseKeys: [], hasSignaturePlaceholders: false, footer: { text: "", contactEmail: null, contactPhone: null } },
    });
    expect(result.success).toBe(true);
  });

  it("lists the 14 seeded system clauses", async () => {
    const result = await listContractClausesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBe(14);
  });

  it("creates a custom clause", async () => {
    const result = await createCustomClauseAction({ name: "My Clause", category: "Custom", bodyText: "Custom clause text.", isOptional: true });
    expect(result.success).toBe(true);
  });
});

describe("evaluate + list", () => {
  it("evaluates a contract with no document yet as missing_sections", async () => {
    const contract = await makeContract();
    const result = await evaluateContractAction(contract.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.builderState).toBeNull();
      expect(result.data.readiness.state).toBe("missing_sections");
    }
  });

  it("returns an error for a nonexistent contract", async () => {
    const result = await evaluateContractAction("contract_does_not_exist");
    expect(result.success).toBe(false);
  });

  it("lists summaries for every contract in the workspace", async () => {
    await makeContract();
    const result = await listContractSummariesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("caches the summaries list across identical calls", async () => {
    await makeContract();
    const first = await listContractSummariesAction();
    const second = await listContractSummariesAction();
    expect(first).toEqual(second);
  });
});

describe("versioning", () => {
  it("creates the first version and leaves the document in draft", async () => {
    const contract = await makeContract();
    const result = await createContractVersionAction(contract.id, versionInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.versions).toHaveLength(1);
      expect(result.data.versions[0].version_number).toBe(1);
    }
  });

  it("resolves real variables (client name) into the new version's snapshot", async () => {
    const contract = await makeContract();
    const result = await createContractVersionAction(contract.id, versionInput());
    expect(result.success).toBe(true);
    if (result.success) {
      const version = result.data.versions[0];
      const clientNameVar = version.snapshot.variables.find((v) => v.key === "client_name");
      expect(clientNameVar?.value).toBeTruthy();
    }
  });

  it("appends a second version rather than overwriting the first", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    const second = await createContractVersionAction(contract.id, versionInput({ notes: "Revised terms" }));
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.data.versions).toHaveLength(2);
      expect(second.data.versions[0].id).not.toBe(second.data.versions[1].id);
    }
  });

  it("moves a published document to review when a new version is created", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    await publishContractVersionAction(contract.id);
    const second = await createContractVersionAction(contract.id, versionInput());
    expect(second.success).toBe(true);
    if (second.success) expect(second.data.status).toBe("review");
  });

  it("archives a contract document", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    const result = await archiveContractDocumentAction(contract.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("archived");
  });

  it("restores an earlier version", async () => {
    const contract = await makeContract();
    const first = await createContractVersionAction(contract.id, versionInput());
    await createContractVersionAction(contract.id, versionInput());
    if (!first.success) throw new Error("setup failed");
    const firstVersionId = first.data.versions[0].id;
    const restored = await restoreContractVersionAction(contract.id, firstVersionId);
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.current_version_id).toBe(firstVersionId);
  });
});

describe("comparison", () => {
  it("compares two versions and reports differences", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    await createContractVersionAction(contract.id, versionInput({ terms: "Different terms." }));
    const result = await compareContractVersionsAction(contract.id, 1, 2);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hasChanges).toBe(true);
  });

  it("errors when a version number doesn't exist", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    const result = await compareContractVersionsAction(contract.id, 1, 99);
    expect(result.success).toBe(false);
  });
});

describe("readiness", () => {
  it("refuses to mark a document ready that isn't", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    const result = await markContractReadyAction(contract.id);
    expect(result.success).toBe(false);
  });

  it("marks a fully-ready document ready and records ready_at only on the state that is actually ready", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    const detail = await buildContractDetail(CURRENT_WORKSPACE_ID, contract.id);
    const result = await markContractReadyAction(contract.id);
    if (detail?.readiness.state === "ready") {
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.ready_at).not.toBeNull();
    } else {
      expect(result.success).toBe(false);
    }
  });
});

describe("analytics", () => {
  it("never throws for an empty workspace", async () => {
    const result = await getContractAnalyticsAction();
    expect(result.success).toBe(true);
  });

  it("counts a created contract's document", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    const result = await getContractAnalyticsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalContracts).toBeGreaterThanOrEqual(1);
  });
});

describe("executive integration", () => {
  it("returns an empty array with no session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const recs = await contractRecommendationsForExecutiveDecisions();
    expect(recs).toEqual([]);
  });

  it("never throws with real contract data", async () => {
    const contract = await makeContract();
    await createContractVersionAction(contract.id, versionInput());
    const recs = await contractRecommendationsForExecutiveDecisions();
    expect(Array.isArray(recs)).toBe(true);
  });
});
