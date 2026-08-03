import { describe, expect, it } from "vitest";
import { buildExecutionContext, buildExecutionMetadata, type PackageContextInput } from "@/core/executionPackage/packageBuilderEngine";

function baseInput(overrides: Partial<PackageContextInput> = {}): PackageContextInput {
  return { planContextType: "event", planContext: { nodeType: "event", nodeId: "event_1" }, customer: null, locationPlaceholder: null, requestedPriority: null, priorityOverride: null, ...overrides };
}

describe("buildExecutionContext", () => {
  it("carries the plan's own context type/context through unchanged", () => {
    const context = buildExecutionContext(baseInput());
    expect(context.context_type).toBe("event");
    expect(context.context).toEqual({ nodeType: "event", nodeId: "event_1" });
  });

  it("defaults priority to medium when neither an override nor a requested priority is given", () => {
    const context = buildExecutionContext(baseInput());
    expect(context.priority).toBe("medium");
  });

  it("prefers the requested priority over the default", () => {
    const context = buildExecutionContext(baseInput({ requestedPriority: "high" }));
    expect(context.priority).toBe("high");
  });

  it("prefers an explicit override over the requested priority", () => {
    const context = buildExecutionContext(baseInput({ requestedPriority: "high", priorityOverride: "critical" }));
    expect(context.priority).toBe("critical");
  });

  it("carries customer and location through unchanged", () => {
    const context = buildExecutionContext(baseInput({ customer: { nodeType: "client", nodeId: "client_1" }, locationPlaceholder: "123 Main St" }));
    expect(context.customer).toEqual({ nodeType: "client", nodeId: "client_1" });
    expect(context.location_placeholder).toBe("123 Main St");
  });
});

describe("buildExecutionMetadata", () => {
  it("derives a title from the plan name", () => {
    const metadata = buildExecutionMetadata("Amoré Wedding — Setup Plan");
    expect(metadata.title).toBe("Amoré Wedding — Setup Plan — Execution Package");
  });

  it("defaults notes to null and tags to an empty array", () => {
    const metadata = buildExecutionMetadata("Plan");
    expect(metadata.notes).toBeNull();
    expect(metadata.tags).toEqual([]);
  });
});
