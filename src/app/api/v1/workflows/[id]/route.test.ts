import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/workflows/[id]/route";
import { createApiKey, resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";
import { mockWorkflowRepository, resetWorkflowStore } from "@/lib/data/core/workflow/mockRepository";
import type { CreateWorkflowInput } from "@/lib/data/core/workflow/repository";
import type { WorkflowGraph } from "@/types/workflow";

function emptyGraph(): WorkflowGraph {
  return { nodes: [], edges: [], variables: [] };
}

function createInput(overrides: Partial<CreateWorkflowInput> = {}): CreateWorkflowInput {
  return {
    metadata: { name: "Test Workflow", description: "A workflow for API tests.", category: "operations", tags: [] },
    executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
    graph: emptyGraph(),
    ...overrides,
  };
}

async function requestWithScopes(workflowId: string, scopes: import("@/types/apiScope").ApiScope[], workspaceId = "ws_1"): Promise<Request> {
  const { secret } = await createApiKey(workspaceId, "member_1", { name: "Test", scopes });
  return new Request(`http://localhost/api/v1/workflows/${workflowId}`, { headers: { authorization: `Bearer ${secret}` } });
}

afterEach(() => {
  resetApiKeyStore();
  resetWorkflowStore();
});

describe("GET /api/v1/workflows/:id", () => {
  it("returns the Workflow for a same-workspace caller with workflow.read", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");

    const response = await GET((await requestWithScopes(created.data.id, ["workflow.read"])) as never, { params: Promise.resolve({ id: created.data.id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(created.data.id);
    expect(body.data.workspaceId).toBe("ws_1");
  });

  it("Phase 09B — does NOT disclose a Workflow belonging to a different workspace, even with a valid workflow.read key", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_2", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");

    // A valid workflow.read key for ws_1, requesting a Workflow that actually belongs to ws_2.
    const response = await GET((await requestWithScopes(created.data.id, ["workflow.read"], "ws_1")) as never, { params: Promise.resolve({ id: created.data.id }) });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
    expect(JSON.stringify(body)).not.toContain(created.data.workspaceId);
  });

  it("returns the identical not_found error for a cross-workspace Workflow and a nonexistent id (no enumeration signal)", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_2", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");

    const crossWorkspaceResponse = await GET((await requestWithScopes(created.data.id, ["workflow.read"], "ws_1")) as never, { params: Promise.resolve({ id: created.data.id }) });
    const nonexistentResponse = await GET((await requestWithScopes("does-not-exist", ["workflow.read"], "ws_1")) as never, { params: Promise.resolve({ id: "does-not-exist" }) });

    expect(crossWorkspaceResponse.status).toBe(nonexistentResponse.status);
    const [crossWorkspaceBody, nonexistentBody] = await Promise.all([crossWorkspaceResponse.json(), nonexistentResponse.json()]);
    expect(crossWorkspaceBody.error.code).toBe(nonexistentBody.error.code);
  });

  it("still requires the workflow.read scope — an unrelated scope is denied before any workspace check runs", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");

    const response = await GET((await requestWithScopes(created.data.id, ["crm.read"])) as never, { params: Promise.resolve({ id: created.data.id }) });
    expect(response.status).toBe(403);
  });

  it("a workspace id can't be spoofed through the request — only the authenticated API key's own workspace is ever used", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");

    const { secret } = await createApiKey("ws_2", "member_1", { name: "Test", scopes: ["workflow.read"] });
    // Even if a caller tries to smuggle a workspace id via a query string, the handler never reads request data for this — only `auth.workspaceId` from the verified key.
    const request = new Request(`http://localhost/api/v1/workflows/${created.data.id}?workspaceId=ws_1`, { headers: { authorization: `Bearer ${secret}` } });
    const response = await GET(request as never, { params: Promise.resolve({ id: created.data.id }) });
    expect(response.status).toBe(404);
  });
});
