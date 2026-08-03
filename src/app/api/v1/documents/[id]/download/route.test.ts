import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/documents/[id]/download/route";
import { createApiKey, resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";
import { resetAllMockData } from "@/lib/data";
import { getDocumentsManager } from "@/core/documents/manager";
import { resetDocumentsStore } from "@/lib/data/core/documents/mockRepository";
import type { CreateTemplateInput } from "@/lib/data/core/documents/repository";
import type { MergeContext } from "@/types/documentPlatform";

const context: MergeContext = { workspaceId: "ws_1", memberId: "member_1" };
const openPermissions = { permissions: [], role: null };

const templateInput: CreateTemplateInput = {
  documentTypeId: "contract",
  name: "Welcome Guide",
  description: "A short welcome document.",
  content: [{ id: "p1", type: "paragraph", runs: [{ text: "Welcome to Amoré Bloom." }] }],
  header: [],
  footer: [],
  variables: [],
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
};

async function authedRequest(url: string): Promise<Request> {
  const { secret } = await createApiKey("ws_1", "member_1", { name: "Test", scopes: ["documents.read"] });
  return new Request(url, { headers: { authorization: `Bearer ${secret}` } });
}

async function createRealDocumentId(): Promise<string> {
  const created = await getDocumentsManager().createTemplate("ws_1", "member_1", templateInput);
  if (!created.success) throw new Error("setup failed");
  const result = await getDocumentsManager().compileAndCreateDocument(created.data.id, context, openPermissions);
  if (!result.success) throw new Error("setup failed");
  return result.document.id;
}

beforeEach(() => {
  resetDocumentsStore();
});

afterEach(() => {
  resetApiKeyStore();
  resetAllMockData();
});

describe("GET /api/v1/documents/:id/download", () => {
  it("returns the plain-text JSON envelope by default", async () => {
    const id = await createRealDocumentId();
    const response = await GET((await authedRequest(`http://localhost/api/v1/documents/${id}/download`)) as never, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.text).toContain("Welcome to Amoré Bloom.");
  });

  it("returns a real application/pdf binary when ?format=pdf is set", async () => {
    const id = await createRealDocumentId();
    const response = await GET((await authedRequest(`http://localhost/api/v1/documents/${id}/download?format=pdf`)) as never, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const prefix = Array.from(bytes.slice(0, 5)).map((byte) => String.fromCharCode(byte)).join("");
    expect(prefix).toBe("%PDF-");
  });

  it("returns a not_found ApiError (never an unhandled 500) for an unknown id", async () => {
    const response = await GET((await authedRequest("http://localhost/api/v1/documents/does-not-exist/download")) as never, { params: Promise.resolve({ id: "does-not-exist" }) });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });
});
