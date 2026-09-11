import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { GET } from "@/app/api/contracts/[id]/pdf/route";
import { createContract, resetAllMockData } from "@/lib/data";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { ContractInput } from "@/modules/contracts/schema";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["contracts.view"],
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

function call(id: string) {
  return GET(new Request(`https://app.test/api/contracts/${id}/pdf`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  resetAllMockData();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/contracts/:id/pdf — CONTRACTS-02", () => {
  it("streams a real application/pdf for an authorized member with contracts.view", async () => {
    const contract = await makeContract();
    const response = await call(contract.id);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("returns 404 when there is no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const contract = await makeContract();
    const response = await call(contract.id);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the acting member lacks contracts.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, permissions: [] });
    const contract = await makeContract();
    const response = await call(contract.id);
    expect(response.status).toBe(404);
  });

  it("returns 404 for a contract in a different workspace", async () => {
    const contract = await makeContract();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, workspace: { id: "ws_other", name: "Other Workspace" } });
    const response = await call(contract.id);
    expect(response.status).toBe(404);
  });

  it("returns 404 for a nonexistent contract id", async () => {
    const response = await call("contract_does_not_exist");
    expect(response.status).toBe(404);
  });
});
