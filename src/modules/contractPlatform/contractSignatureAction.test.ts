import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));
vi.mock("@/core/integrations/integrationManager", () => ({ listConnections: vi.fn() }));
vi.mock("@/core/integrations/credentialManager", () => ({ resolveAccessToken: vi.fn() }));

const createSignatureRequestMock = vi.fn();
vi.mock("@/core/integrations/providers/docusign/docusignProvider", () => ({
  DocuSignProvider: vi.fn().mockImplementation(function DocuSignProviderMock() {
    return { createSignatureRequest: createSignatureRequestMock };
  }),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { listConnections } from "@/core/integrations/integrationManager";
import { resolveAccessToken } from "@/core/integrations/credentialManager";
import { sendContractForSignatureAction } from "@/modules/contractPlatform/contractPlatformActions";
import { createContract, getContract, resetAllMockData } from "@/lib/data";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { ContractInput } from "@/modules/contracts/schema";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["contracts.lifecycle"],
  workspaceDisplayName: "Amoré Bloom",
};

function contractInput(overrides: Partial<ContractInput> = {}): ContractInput {
  return {
    client_id: "client_2",
    event_id: "event_1",
    template_id: null,
    title: "Test Contract",
    description: "A test contract for Jordan Ellis.",
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
  if (!created.success) throw new Error(`setup failed: ${JSON.stringify(created.error)}`);
  return created.data;
}

const connectedDocuSign = {
  id: "conn_docusign_1",
  workspace_id: CURRENT_WORKSPACE_ID,
  provider_id: "docusign",
  state: "connected",
  config: { docusign_account_id: "acct_1", docusign_account_base_uri: "https://demo.docusign.net" },
  credential_id: "cred_1",
  capabilities: ["signature", "webhook", "oauth"],
  version: 1,
  installed_by: "member_1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  last_state_change_at: "2026-01-01T00:00:00Z",
  last_health_check_at: null,
  last_sync_at: null,
  failure_count: 0,
  retry_count: 0,
};

beforeEach(() => {
  resetAllMockData();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
  vi.mocked(listConnections).mockReturnValue([connectedDocuSign] as never);
  vi.mocked(resolveAccessToken).mockResolvedValue("tok_123");
  createSignatureRequestMock.mockResolvedValue({ externalRequestId: "env_1" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("sendContractForSignatureAction — v2 Checkpoint 44, Step 9", () => {
  it("sends a real DocuSign envelope and flips the Contract's own signature_status to sent", async () => {
    const contract = await makeContract();
    const result = await sendContractForSignatureAction(contract.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.signature_status).toBe("sent");
    expect(createSignatureRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ documentName: "Test Contract.pdf", signers: [{ name: "Jordan Ellis", email: "jordan.ellis@example.com" }] }),
    );

    const persisted = await getContract(contract.id);
    expect(persisted.signature_status).toBe("sent");
  });

  it("fails honestly (never flips status) when no DocuSign account is connected", async () => {
    vi.mocked(listConnections).mockReturnValue([]);
    const contract = await makeContract();
    const result = await sendContractForSignatureAction(contract.id);
    expect(result.success).toBe(false);

    const persisted = await getContract(contract.id);
    expect(persisted.signature_status).toBe("unsigned");
  });

  it("rejects sending a contract that's already been sent for signature", async () => {
    const contract = await makeContract();
    await sendContractForSignatureAction(contract.id);
    const secondAttempt = await sendContractForSignatureAction(contract.id);
    expect(secondAttempt.success).toBe(false);
  });

  it("never calls DocuSign and returns failure when the acting member lacks contracts.lifecycle", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, permissions: [] });
    const contract = await makeContract();
    const result = await sendContractForSignatureAction(contract.id);
    expect(result.success).toBe(false);
    expect(createSignatureRequestMock).not.toHaveBeenCalled();
  });

  it("reports a sanitized error and never flips status when the DocuSign call itself fails", async () => {
    createSignatureRequestMock.mockRejectedValue(new Error("DocuSign API unavailable"));
    const contract = await makeContract();
    const result = await sendContractForSignatureAction(contract.id);
    expect(result.success).toBe(false);

    const persisted = await getContract(contract.id);
    expect(persisted.signature_status).toBe("unsigned");
  });
});
