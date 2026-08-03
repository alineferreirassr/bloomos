import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { validateRelationshipMutation } from "@/core/knowledge/relationshipConstraintsEngine";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { KNOWLEDGE_NODE_TYPES, RELATIONSHIP_TYPES, RELATIONSHIP_TYPE_LABELS, type KnowledgeNodeRef, type KnowledgeNodeType, type RelationshipType } from "@/types/knowledgeGraph";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { CreateRelationshipInput } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const ADD_RELATIONSHIP_ACTION_ID = "add-relationship";

/**
 * v2.0 Checkpoint 39 — the fully generic Knowledge Graph relationship
 * Action: any two real node refs, any real `RelationshipType`. Calls
 * `getCoreKnowledgeGraphService().createRelationship()` directly (the same
 * real service `createRelationshipAction()` calls after its own
 * `resolveMemberSessionSnapshot()`), running the exact same
 * `validateRelationshipMutation()` constraint check that action runs
 * before creating, so a Workflow can never write an edge the Relationship
 * Explorer's own manual flow would have blocked.
 */
const addRelationshipAction: AutomationActionDefinition = {
  id: ADD_RELATIONSHIP_ACTION_ID,
  name: "Add Relationship",
  description: "Creates a real Knowledge Graph relationship between two records.",
  category: "general",
  version: "automation-action-add-relationship-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const sourceNodeType = params.facts.sourceNodeType;
    const sourceNodeId = params.facts.sourceNodeId;
    const targetNodeType = params.facts.targetNodeType;
    const targetNodeId = params.facts.targetNodeId;
    const relationshipType = params.facts.relationshipType;
    if (typeof sourceNodeType !== "string" || typeof sourceNodeId !== "string" || typeof targetNodeType !== "string" || typeof targetNodeId !== "string" || typeof relationshipType !== "string") {
      return { success: false, message: "Missing sourceNodeType, sourceNodeId, targetNodeType, targetNodeId, or relationshipType in the trigger's own facts." };
    }
    if (!(KNOWLEDGE_NODE_TYPES as readonly string[]).includes(sourceNodeType) || !(KNOWLEDGE_NODE_TYPES as readonly string[]).includes(targetNodeType)) {
      return { success: false, message: "sourceNodeType or targetNodeType is not a real Knowledge Graph node type." };
    }
    if (!(RELATIONSHIP_TYPES as readonly string[]).includes(relationshipType)) {
      return { success: false, message: `"${relationshipType}" is not a real relationship type.` };
    }

    const source: KnowledgeNodeRef = { nodeType: sourceNodeType as KnowledgeNodeType, nodeId: sourceNodeId };
    const target: KnowledgeNodeRef = { nodeType: targetNodeType as KnowledgeNodeType, nodeId: targetNodeId };
    const existing = await getCoreKnowledgeGraphService().listRelationshipsForWorkspace(params.workspaceId);
    const check = validateRelationshipMutation(source, target, relationshipType as RelationshipType, existing);
    if (!check.allowed) return { success: false, message: check.hardViolations.join(" ") };

    const input: CreateRelationshipInput = {
      sourceNodeType: source.nodeType,
      sourceNodeId: source.nodeId,
      targetNodeType: target.nodeType,
      targetNodeId: target.nodeId,
      relationshipType: relationshipType as RelationshipType,
      source: "automation",
    };
    const result = await getCoreKnowledgeGraphService().createRelationship(params.workspaceId, params.userId ?? "system", input);
    if (!result.success) return { success: false, message: result.error };

    const owner = (ENTITY_TYPES as readonly string[]).includes(source.nodeType) ? source : (ENTITY_TYPES as readonly string[]).includes(target.nodeType) ? target : null;
    if (owner) {
      recordTimelineActivity(params.workspaceId, owner.nodeType as EntityType, owner.nodeId, "knowledge_relationship_created", `${RELATIONSHIP_TYPE_LABELS[relationshipType as RelationshipType]}: ${sourceNodeType}:${sourceNodeId} → ${targetNodeType}:${targetNodeId} (via Workflow automation)`);
    }
    return { success: true, message: `Relationship "${RELATIONSHIP_TYPE_LABELS[relationshipType as RelationshipType]}" created.` };
  },
};

export default addRelationshipAction;
