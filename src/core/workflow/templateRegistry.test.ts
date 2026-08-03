import { afterEach, describe, expect, it } from "vitest";
import { registerWorkflowTemplate, unregisterWorkflowTemplate, getWorkflowTemplate, listWorkflowTemplates, resetWorkflowTemplateRegistry } from "@/core/workflow/templateRegistry";
import type { WorkflowTemplate } from "@/types/workflow";

function stubTemplate(overrides: Partial<WorkflowTemplate> = {}): WorkflowTemplate {
  return {
    id: "template.stub",
    name: "Stub Template",
    description: "A minimal Template for registry tests.",
    category: "operations",
    graph: { nodes: [], edges: [], variables: [] },
    ...overrides,
  };
}

describe("Workflow Template Registry", () => {
  afterEach(() => resetWorkflowTemplateRegistry());

  it("registers and retrieves a Template by id", () => {
    registerWorkflowTemplate(stubTemplate());
    expect(getWorkflowTemplate("template.stub")?.name).toBe("Stub Template");
  });

  it("returns undefined for an unregistered id", () => {
    expect(getWorkflowTemplate("template.missing")).toBeUndefined();
  });

  it("overwrites an existing Template when registering the same id again", () => {
    registerWorkflowTemplate(stubTemplate());
    registerWorkflowTemplate(stubTemplate({ name: "Updated Stub" }));
    expect(getWorkflowTemplate("template.stub")?.name).toBe("Updated Stub");
    expect(listWorkflowTemplates()).toHaveLength(1);
  });

  it("unregisters a Template", () => {
    registerWorkflowTemplate(stubTemplate());
    unregisterWorkflowTemplate("template.stub");
    expect(getWorkflowTemplate("template.stub")).toBeUndefined();
  });

  it("lists every registered Template sorted alphabetically by name", () => {
    registerWorkflowTemplate(stubTemplate({ id: "template.b", name: "Zebra" }));
    registerWorkflowTemplate(stubTemplate({ id: "template.a", name: "Apple" }));
    expect(listWorkflowTemplates().map((template) => template.name)).toEqual(["Apple", "Zebra"]);
  });

  it("resetWorkflowTemplateRegistry clears every registered Template", () => {
    registerWorkflowTemplate(stubTemplate());
    resetWorkflowTemplateRegistry();
    expect(listWorkflowTemplates()).toHaveLength(0);
  });
});
