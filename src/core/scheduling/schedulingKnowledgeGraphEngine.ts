import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { Appointment, Reservation, Calendar } from "@/types/scheduling";

/**
 * v2.0 Checkpoint 27, Step 15 — Knowledge Graph Integration. Pure
 * builders — never a fabricated node. `Reservation.resource_type` can be
 * `"asset"`, but there is no `"asset"` `KnowledgeNodeType` (Checkpoint 25's
 * DAM uses `"media_asset"`, a distinct concept), so an `"asset"`
 * reservation never produces a `reserved_for` relationship — the same
 * disclosed-gap discipline `types/capability.ts` established for
 * `requires_skill`/`requires_certification`/`requires_language`.
 * `schedulingActions.ts` (Step 19) is responsible for actually persisting
 * whatever these builders return via the Knowledge Graph service.
 */

export type SchedulingRelationshipType = "scheduled_for" | "reserved_for" | "conflicts_with" | "belongs_to_calendar";

export interface SchedulingRelationshipSpec {
  sourceNode: KnowledgeNodeRef;
  targetNode: KnowledgeNodeRef;
  relationshipType: SchedulingRelationshipType;
}

/** `scheduled_for`: the appointment's assigned worker → the appointment's own context node. */
export function buildScheduledForRelationship(appointment: Pick<Appointment, "worker_id" | "context">): SchedulingRelationshipSpec | null {
  if (appointment.worker_id === null || appointment.context === null) return null;
  return { sourceNode: { nodeType: "worker", nodeId: appointment.worker_id }, targetNode: appointment.context, relationshipType: "scheduled_for" };
}

/** `reserved_for`: the reservation's own resource node → the linked appointment's context node. */
export function buildReservedForRelationship(reservation: Pick<Reservation, "resource_type" | "resource_id">, linkedAppointment: Pick<Appointment, "context"> | null): SchedulingRelationshipSpec | null {
  if (linkedAppointment === null || linkedAppointment.context === null) return null;
  if (reservation.resource_type === "asset") return null;
  return { sourceNode: { nodeType: reservation.resource_type, nodeId: reservation.resource_id }, targetNode: linkedAppointment.context, relationshipType: "reserved_for" };
}

/** `conflicts_with`: the earlier appointment's context node → the later one's — deterministic direction so the same conflicting pair never produces two mirrored edges. */
export function buildConflictsWithRelationship(a: Pick<Appointment, "starts_at" | "context">, b: Pick<Appointment, "starts_at" | "context">): SchedulingRelationshipSpec | null {
  const aContext = a.context;
  const bContext = b.context;
  if (aContext === null || bContext === null) return null;
  const [sourceNode, targetNode] = a.starts_at <= b.starts_at ? [aContext, bContext] : [bContext, aContext];
  return { sourceNode, targetNode, relationshipType: "conflicts_with" };
}

/** `belongs_to_calendar`: the appointment's context node → the calendar's own context node. */
export function buildBelongsToCalendarRelationship(appointment: Pick<Appointment, "context">, calendar: Pick<Calendar, "context">): SchedulingRelationshipSpec | null {
  if (appointment.context === null || calendar.context === null) return null;
  return { sourceNode: appointment.context, targetNode: calendar.context, relationshipType: "belongs_to_calendar" };
}
