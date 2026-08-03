import { afterEach, describe, expect, it } from "vitest";
import { mockWorkflowRepository, resetWorkflowStore } from "@/lib/data/core/workflow/mockRepository";
import type { CreateWorkflowInput, RecordPublishedVersionInput } from "@/lib/data/core/workflow/repository";
import type { WorkflowGraph } from "@/types/workflow";

function emptyGraph(): WorkflowGraph {
  return { nodes: [], edges: [], variables: [] };
}

function createInput(overrides: Partial<CreateWorkflowInput> = {}): CreateWorkflowInput {
  return {
    metadata: { name: "Test Workflow", description: "A workflow for storage tests.", category: "operations", tags: [] },
    executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
    graph: emptyGraph(),
    ...overrides,
  };
}

afterEach(() => resetWorkflowStore());

describe("mockWorkflowRepository", () => {
  it("creates a Workflow in draft status, version 0", async () => {
    const result = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.currentVersion).toBe(0);
      expect(result.data.workspaceId).toBe("ws_1");
    }
  });

  it("listWorkflows scopes strictly by workspaceId", async () => {
    await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    await mockWorkflowRepository.createWorkflow("ws_2", "user_1", createInput());
    const results = await mockWorkflowRepository.listWorkflows("ws_1");
    expect(results).toHaveLength(1);
    expect(results[0].workspaceId).toBe("ws_1");
  });

  it("updateWorkflowDraft updates only the fields provided", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");

    const result = await mockWorkflowRepository.updateWorkflowDraft(created.data.id, { metadata: { ...created.data.metadata, name: "Renamed" } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.name).toBe("Renamed");
      expect(result.data.executionPolicy).toEqual(created.data.executionPolicy);
    }
  });

  it("updateWorkflowDraft fails for an archived Workflow", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");
    await mockWorkflowRepository.archiveWorkflow(created.data.id);

    const result = await mockWorkflowRepository.updateWorkflowDraft(created.data.id, { metadata: created.data.metadata });
    expect(result.success).toBe(false);
  });

  it("archiveWorkflow then unarchiveWorkflow returns it to draft when it was never published", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");
    await mockWorkflowRepository.archiveWorkflow(created.data.id);

    const result = await mockWorkflowRepository.unarchiveWorkflow(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("draft");
  });

  it("unarchiveWorkflow returns it to published when it had already been published", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");
    await mockWorkflowRepository.recordPublishedVersion(created.data.id, publishInput(created.data.id));
    await mockWorkflowRepository.archiveWorkflow(created.data.id);

    const result = await mockWorkflowRepository.unarchiveWorkflow(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("published");
  });

  it("cloneWorkflow creates a new Workflow copying the source's current draft, independent of the source", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");

    const cloned = await mockWorkflowRepository.cloneWorkflow(created.data.id, "user_2");
    expect(cloned.success).toBe(true);
    if (cloned.success) {
      expect(cloned.data.id).not.toBe(created.data.id);
      expect(cloned.data.status).toBe("draft");
      expect(cloned.data.currentVersion).toBe(0);
      expect(cloned.data.createdBy).toBe("user_2");
      expect(cloned.data.metadata.name).toBe("Test Workflow (Copy)");
    }

    const originalStillExists = await mockWorkflowRepository.getWorkflowById(created.data.id);
    expect(originalStillExists?.status).toBe("draft");
  });

  function publishInput(workflowId: string, overrides: Partial<RecordPublishedVersionInput> = {}): RecordPublishedVersionInput {
    return {
      graph: emptyGraph(),
      metadata: { name: "Test Workflow", description: "A workflow for storage tests.", category: "operations", tags: [] },
      executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
      compiledAutomationIds: [`workflow-${workflowId}-automation-1`],
      publishedBy: "user_1",
      ...overrides,
    };
  }

  describe("recordPublishedVersion", () => {
    it("creates version 1 and flips the Workflow to published", async () => {
      const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
      if (!created.success) throw new Error("setup failed");

      const result = await mockWorkflowRepository.recordPublishedVersion(created.data.id, publishInput(created.data.id));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.version).toBe(1);

      const workflow = await mockWorkflowRepository.getWorkflowById(created.data.id);
      expect(workflow?.status).toBe("published");
      expect(workflow?.currentVersion).toBe(1);
    });

    it("publishing again creates version 2, never mutating version 1", async () => {
      const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
      if (!created.success) throw new Error("setup failed");
      await mockWorkflowRepository.recordPublishedVersion(created.data.id, publishInput(created.data.id, { compiledAutomationIds: ["a1"] }));
      await mockWorkflowRepository.recordPublishedVersion(created.data.id, publishInput(created.data.id, { compiledAutomationIds: ["a2"] }));

      const versions = await mockWorkflowRepository.getWorkflowVersions(created.data.id);
      expect(versions.map((version) => version.version).sort()).toEqual([1, 2]);
      const v1 = versions.find((version) => version.version === 1);
      expect(v1?.compiledAutomationIds).toEqual(["a1"]);
    });

    it("fails for an unknown Workflow id", async () => {
      const result = await mockWorkflowRepository.recordPublishedVersion("missing", publishInput("missing"));
      expect(result.success).toBe(false);
    });
  });

  describe("getWorkflowVersions / getWorkflowVersion", () => {
    it("returns versions newest-first", async () => {
      const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
      if (!created.success) throw new Error("setup failed");
      await mockWorkflowRepository.recordPublishedVersion(created.data.id, publishInput(created.data.id));
      await mockWorkflowRepository.recordPublishedVersion(created.data.id, publishInput(created.data.id));
      const versions = await mockWorkflowRepository.getWorkflowVersions(created.data.id);
      expect(versions.map((version) => version.version)).toEqual([2, 1]);
    });

    it("getWorkflowVersion returns null for a version that doesn't exist", async () => {
      const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
      if (!created.success) throw new Error("setup failed");
      expect(await mockWorkflowRepository.getWorkflowVersion(created.data.id, 5)).toBeNull();
    });
  });

  describe("restoreWorkflowVersion", () => {
    it("copies a prior version's own graph/metadata/executionPolicy back onto the current draft", async () => {
      const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
      if (!created.success) throw new Error("setup failed");
      await mockWorkflowRepository.recordPublishedVersion(
        created.data.id,
        publishInput(created.data.id, { metadata: { name: "Version 1 Name", description: "v1", category: "finance", tags: [] } }),
      );
      await mockWorkflowRepository.updateWorkflowDraft(created.data.id, { metadata: { name: "Drifted Draft Name", description: "drifted", category: "operations", tags: [] } });

      const result = await mockWorkflowRepository.restoreWorkflowVersion(created.data.id, 1);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.metadata.name).toBe("Version 1 Name");
    });

    it("never mutates the version record itself", async () => {
      const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
      if (!created.success) throw new Error("setup failed");
      await mockWorkflowRepository.recordPublishedVersion(created.data.id, publishInput(created.data.id));
      await mockWorkflowRepository.restoreWorkflowVersion(created.data.id, 1);

      const version = await mockWorkflowRepository.getWorkflowVersion(created.data.id, 1);
      expect(version?.version).toBe(1);
    });

    it("does not change status or currentVersion", async () => {
      const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
      if (!created.success) throw new Error("setup failed");
      await mockWorkflowRepository.recordPublishedVersion(created.data.id, publishInput(created.data.id));
      const result = await mockWorkflowRepository.restoreWorkflowVersion(created.data.id, 1);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("published");
        expect(result.data.currentVersion).toBe(1);
      }
    });

    it("fails for a version that doesn't exist", async () => {
      const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
      if (!created.success) throw new Error("setup failed");
      const result = await mockWorkflowRepository.restoreWorkflowVersion(created.data.id, 99);
      expect(result.success).toBe(false);
    });
  });

  it("resetWorkflowStore clears both workflows and versions", async () => {
    const created = await mockWorkflowRepository.createWorkflow("ws_1", "user_1", createInput());
    if (!created.success) throw new Error("setup failed");
    await mockWorkflowRepository.recordPublishedVersion(created.data.id, publishInput(created.data.id));
    resetWorkflowStore();
    expect(await mockWorkflowRepository.listWorkflows("ws_1")).toEqual([]);
    expect(await mockWorkflowRepository.getWorkflowVersions(created.data.id)).toEqual([]);
  });
});
