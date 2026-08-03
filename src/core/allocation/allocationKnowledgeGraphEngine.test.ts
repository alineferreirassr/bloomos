import { describe, expect, it } from "vitest";
import { buildAllocatedToRelationship, buildDependsOnRelationship, buildBackupForRelationship, buildSharesResourceWithRelationship } from "@/core/allocation/allocationKnowledgeGraphEngine";

const EVENT_CONTEXT = { nodeType: "event" as const, nodeId: "event_1" };
const OTHER_EVENT_CONTEXT = { nodeType: "event" as const, nodeId: "event_2" };

describe("buildAllocatedToRelationship", () => {
  it("builds resource -> request context", () => {
    const result = buildAllocatedToRelationship({ resource_type: "worker", resource_id: "worker_1" }, EVENT_CONTEXT);
    expect(result).toEqual({ sourceNode: { nodeType: "worker", nodeId: "worker_1" }, targetNode: EVENT_CONTEXT, relationshipType: "allocated_to" });
  });

  it("is null when the request has no real context node", () => {
    expect(buildAllocatedToRelationship({ resource_type: "worker", resource_id: "worker_1" }, null)).toBeNull();
  });

  it("is null for a resource_type with no matching node type", () => {
    expect(buildAllocatedToRelationship({ resource_type: "asset", resource_id: "asset_1" }, EVENT_CONTEXT)).toBeNull();
  });
});

describe("buildDependsOnRelationship", () => {
  it("builds subject -> required resource", () => {
    const result = buildDependsOnRelationship({ resource_type: "equipment", resource_id: "drone_1" }, { resource_type: "worker", resource_id: "worker_1" });
    expect(result).toEqual({ sourceNode: { nodeType: "equipment", nodeId: "drone_1" }, targetNode: { nodeType: "worker", nodeId: "worker_1" }, relationshipType: "depends_on" });
  });

  it("is null when either side has no matching node type", () => {
    expect(buildDependsOnRelationship({ resource_type: "custom", resource_id: "x" }, { resource_type: "worker", resource_id: "worker_1" })).toBeNull();
  });
});

describe("buildBackupForRelationship", () => {
  it("builds backup -> primary", () => {
    const result = buildBackupForRelationship({ resource_type: "worker", resource_id: "worker_backup" }, { resource_type: "worker", resource_id: "worker_primary" });
    expect(result).toEqual({ sourceNode: { nodeType: "worker", nodeId: "worker_backup" }, targetNode: { nodeType: "worker", nodeId: "worker_primary" }, relationshipType: "backup_for" });
  });
});

describe("buildSharesResourceWithRelationship", () => {
  it("orders the pair deterministically regardless of call order", () => {
    const a = buildSharesResourceWithRelationship(OTHER_EVENT_CONTEXT, EVENT_CONTEXT);
    const b = buildSharesResourceWithRelationship(EVENT_CONTEXT, OTHER_EVENT_CONTEXT);
    expect(a).toEqual(b);
    expect(a?.sourceNode).toEqual(EVENT_CONTEXT);
  });

  it("is null when either context is missing", () => {
    expect(buildSharesResourceWithRelationship(null, EVENT_CONTEXT)).toBeNull();
  });
});
