import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  getCurrentClientAccountContext: vi.fn(),
  getContract: vi.fn(),
}));

import { GET } from "@/app/api/client-portal/contracts/[id]/pdf/route";
import { getCurrentClientAccountContext, getContract } from "@/lib/data";

const CONTEXT = { account: { id: "account_1", workspace_id: "ws_1", client_id: "client_1" }, clientName: "Jane Doe", workspaceName: "Amoré Bloom" };
const CONTRACT = {
  id: "contract_1",
  workspace_id: "ws_1",
  client_id: "client_1",
  title: "Test Contract",
  description: "A test contract.",
  notes: null,
  signature_status: "sent",
};

function call(id: string) {
  return GET(new Request(`https://app.test/api/client-portal/contracts/${id}/pdf`), { params: Promise.resolve({ id }) });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/client-portal/contracts/:id/pdf — CONTRACTS-02", () => {
  it("streams a real application/pdf for the contract's own client account holder", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(CONTEXT as never);
    vi.mocked(getContract).mockResolvedValue(CONTRACT as never);

    const response = await call(CONTRACT.id);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("returns 404 when there is no resolvable client session", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(null);
    const response = await call(CONTRACT.id);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the contract belongs to a different client in the same workspace", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(CONTEXT as never);
    vi.mocked(getContract).mockResolvedValue({ ...CONTRACT, client_id: "someone_else" } as never);
    const response = await call(CONTRACT.id);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the contract belongs to a different workspace entirely", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(CONTEXT as never);
    vi.mocked(getContract).mockResolvedValue({ ...CONTRACT, workspace_id: "ws_other" } as never);
    const response = await call(CONTRACT.id);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the contract cannot be found", async () => {
    vi.mocked(getCurrentClientAccountContext).mockResolvedValue(CONTEXT as never);
    vi.mocked(getContract).mockRejectedValue(new Error("not found"));
    const response = await call(CONTRACT.id);
    expect(response.status).toBe(404);
  });
});
