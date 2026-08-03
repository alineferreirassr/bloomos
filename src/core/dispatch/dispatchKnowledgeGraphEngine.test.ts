import { describe, expect, it } from "vitest";
import { buildAssignedResourceRelationship } from "@/core/dispatch/dispatchKnowledgeGraphEngine";

const orderContext = { nodeType: "event" as const, nodeId: "event_1" };

describe("dispatchKnowledgeGraphEngine", () => {
  it("builds an assigned_worker edge from the order context to the worker node", () => {
    const relationship = buildAssignedResourceRelationship(orderContext, "worker", "worker_1");
    expect(relationship).toEqual({
      sourceNode: orderContext,
      targetNode: { nodeType: "worker", nodeId: "worker_1" },
      relationshipType: "assigned_worker",
    });
  });

  it("builds an assigned_vehicle edge", () => {
    const relationship = buildAssignedResourceRelationship(orderContext, "vehicle", "vehicle_1");
    expect(relationship?.relationshipType).toBe("assigned_vehicle");
  });

  it("builds an assigned_equipment edge", () => {
    const relationship = buildAssignedResourceRelationship(orderContext, "equipment", "equipment_1");
    expect(relationship?.relationshipType).toBe("assigned_equipment");
  });

  it("returns null for team and vendor — not among the spec's 3 named resource types", () => {
    expect(buildAssignedResourceRelationship(orderContext, "team", "team_1")).toBeNull();
    expect(buildAssignedResourceRelationship(orderContext, "vendor", "vendor_1")).toBeNull();
  });

  it("returns null for asset/custom — no real node identity", () => {
    expect(buildAssignedResourceRelationship(orderContext, "asset", "asset_1")).toBeNull();
    expect(buildAssignedResourceRelationship(orderContext, "custom", "custom_1")).toBeNull();
  });

  it("returns null when the order has no context node", () => {
    expect(buildAssignedResourceRelationship(null, "worker", "worker_1")).toBeNull();
  });
});
