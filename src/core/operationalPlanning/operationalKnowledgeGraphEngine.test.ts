import { describe, expect, it } from "vitest";
import { buildProducesDeliverableRelationship } from "@/core/operationalPlanning/operationalKnowledgeGraphEngine";

const EVENT_CONTEXT = { nodeType: "event" as const, nodeId: "event_1" };
const DOCUMENT_NODE = { nodeType: "document" as const, nodeId: "document_1" };

describe("buildProducesDeliverableRelationship", () => {
  it("builds plan context -> deliverable's linked node", () => {
    const result = buildProducesDeliverableRelationship(EVENT_CONTEXT, DOCUMENT_NODE);
    expect(result).toEqual({ sourceNode: EVENT_CONTEXT, targetNode: DOCUMENT_NODE, relationshipType: "produces_deliverable" });
  });

  it("is null when the plan has no real context", () => {
    expect(buildProducesDeliverableRelationship(null, DOCUMENT_NODE)).toBeNull();
  });

  it("is null when the deliverable has no linked artifact", () => {
    expect(buildProducesDeliverableRelationship(EVENT_CONTEXT, null)).toBeNull();
  });
});
