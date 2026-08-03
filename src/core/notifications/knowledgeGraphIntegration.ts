import type { Notification } from "@/core/notifications/types";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 41, Step 9 — Knowledge Graph integration. Deliberately
 * NOT a new `KnowledgeNodeType` or a new persisted `KnowledgeRelationship`
 * — `Notification.related_owner_type`/`related_owner_id` (Checkpoint
 * 2/14) already IS the relationship between a notification and the entity
 * it's about; this file only surfaces that already-real link as a summary
 * string, the same "pure function over already-fetched data" shape
 * `core/knowledge/knowledgeGraphBrief.ts`'s `generateRelationshipSummary()`
 * family already established for every other entity.
 *
 * Promoting `notification` to a full graph-traversal node type was
 * considered and rejected: notifications are high-volume and ephemeral
 * (read/archived within hours, not a durable "fact about the business"
 * the way a Client or Contract is), and Checkpoint 40 already hit the
 * exact regression class this would risk — adding a value to `EntityType`
 * that graph/Timeline code silently starts treating as fully capable
 * (see `docs/search-engine.md`'s "EntityType extension and its one side
 * effect"). Restraint here is the "genuinely missing" test the
 * checkpoint's own Step 9 instruction sets, not an oversight.
 */

export interface NotificationActivitySummary {
  node: KnowledgeNodeRef;
  totalNotifications: number;
  unreadNotifications: number;
}

export function computeNotificationActivityForNode(node: KnowledgeNodeRef, notifications: Notification[]): NotificationActivitySummary {
  const related = notifications.filter((n) => n.related_owner_type === node.nodeType && n.related_owner_id === node.nodeId);
  return {
    node,
    totalNotifications: related.length,
    unreadNotifications: related.filter((n) => n.read_at === null && n.archived_at === null).length,
  };
}

export function generateNotificationActivitySummary(summary: NotificationActivitySummary): string {
  if (summary.totalNotifications === 0) return "No notifications reference this record.";
  const unreadPart = summary.unreadNotifications > 0 ? ` (${summary.unreadNotifications} unread)` : "";
  const isSingular = summary.totalNotifications === 1;
  return `${summary.totalNotifications} notification${isSingular ? "" : "s"} ${isSingular ? "references" : "reference"} this record${unreadPart}.`;
}
