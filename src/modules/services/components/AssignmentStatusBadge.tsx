/**
 * An assignment's status IS an `EventServiceStatus` — no separate enum or
 * meaning exists for "assignment status" versus "EventService status", so
 * this re-exports the existing badge under the name the Event Assignment
 * spec asks for rather than building a second component that would render
 * identically.
 */
export { EventServiceStatusBadge as AssignmentStatusBadge } from "@/modules/services/components/EventServiceStatusBadge";
