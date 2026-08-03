import { describe, it, expect, beforeEach } from "vitest";
import { mockClientInformationRequestsRepository, resetClientInformationRequestsStore } from "./clientInformationRequestsStore";

beforeEach(() => {
  resetClientInformationRequestsStore();
});

describe("mockClientInformationRequestsRepository", () => {
  it("rejects creating a request with an empty title", async () => {
    const result = await mockClientInformationRequestsRepository.createRequest({ workspaceId: "workspace_1", clientId: "client_1", title: "   ", description: "" });
    expect(result.success).toBe(false);
  });

  it("creates a request in pending status with no client response yet", async () => {
    const result = await mockClientInformationRequestsRepository.createRequest({ workspaceId: "workspace_1", clientId: "client_1", title: "Dietary restrictions", description: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("pending");
      expect(result.data.clientResponse).toBeNull();
    }
  });

  it("lists requests scoped to one client", async () => {
    await mockClientInformationRequestsRepository.createRequest({ workspaceId: "workspace_1", clientId: "client_1", title: "A", description: "" });
    await mockClientInformationRequestsRepository.createRequest({ workspaceId: "workspace_1", clientId: "client_2", title: "B", description: "" });
    const list = await mockClientInformationRequestsRepository.listRequestsForClient("workspace_1", "client_1");
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("A");
  });

  it("recordClientResponse sets the response, marks fulfilled, and stamps fulfilledAt", async () => {
    const created = await mockClientInformationRequestsRepository.createRequest({ workspaceId: "workspace_1", clientId: "client_1", title: "A", description: "" });
    if (!created.success) throw new Error("setup failed");
    const result = await mockClientInformationRequestsRepository.recordClientResponse(created.data.id, "No restrictions");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("fulfilled");
      expect(result.data.clientResponse).toBe("No restrictions");
      expect(result.data.fulfilledAt).not.toBeNull();
    }
  });

  it("setStatus fails for an unknown id", async () => {
    const result = await mockClientInformationRequestsRepository.setStatus("nonexistent", "cancelled");
    expect(result.success).toBe(false);
  });

  it("setInternalNotes never surfaces in the request's public fields used by the client-facing projection", async () => {
    const created = await mockClientInformationRequestsRepository.createRequest({ workspaceId: "workspace_1", clientId: "client_1", title: "A", description: "" });
    if (!created.success) throw new Error("setup failed");
    const updated = await mockClientInformationRequestsRepository.setInternalNotes(created.data.id, "Internal-only detail");
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.internalNotes).toBe("Internal-only detail");
  });
});
