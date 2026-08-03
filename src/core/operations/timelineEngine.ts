import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { ProposalDraft } from "@/types/proposal";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { InventoryMovement } from "@/types/inventoryMovement";
import type { MediaAsset } from "@/types/mediaAsset";
import type { Event } from "@/types/event";
import type { LiveEventLogEntry } from "@/types/liveEventLogEntry";
import type { OperationsTimelineEntry } from "@/core/operations/types";

/**
 * TimelineEngine (v2 Checkpoint 21, Step 3) — the "Operations Timeline" is a
 * staff-facing aggregator, following the exact pattern the Client Portal's
 * own `aggregateClientPortalTimeline` (Checkpoint 14) already established:
 * a pure function over already-fetched arrays, sorted into one feed. It is
 * deliberately a *separate* aggregator, not a reuse of
 * `ClientPortalTimelineEntry` — that type's 6 kinds are client-safe and
 * intentionally limited; this one surfaces internal-only milestones staff
 * need (inventory reservations, vendor/team assignment, live-event-day
 * check-ins) that a client should never see.
 *
 * Every milestone is derived from a real record already used elsewhere in
 * the app — never fabricated. Two milestones ("Gallery Delivered", "Review
 * Received") have no dedicated "delivered"/"review" field in this codebase
 * today, so they are honestly derived from the closest real proxy (first
 * gallery MediaAsset upload; a staff-logged Live Event note tagged
 * "review") — documented in docs/operations-engine.md rather than silently
 * pretended to be more precise than they are.
 */

export interface TimelineEngineInput {
  event: Event;
  payments: Payment[];
  expenses: Expense[];
  proposals: ProposalDraft[];
  vendorAssignments: EventServiceVendorAssignment[];
  teamRequirements: EventServiceTeamRequirement[];
  schedule: EventScheduleItem[];
  inventoryMovements: InventoryMovement[];
  galleryAssets: MediaAsset[];
  liveEventLog: LiveEventLogEntry[];
}

export function buildOperationsTimeline(input: TimelineEngineInput): OperationsTimelineEntry[] {
  const entries: OperationsTimelineEntry[] = [];

  for (const proposal of input.proposals) {
    entries.push({
      id: `proposal-${proposal.id}`,
      kind: "proposal_created",
      title: "Proposal created",
      description: null,
      occurredAt: proposal.created_at,
    });
  }

  for (const payment of input.payments.filter((p) => p.payment_type === "deposit" && p.status === "succeeded")) {
    entries.push({
      id: `deposit-${payment.id}`,
      kind: "deposit_paid",
      title: "Deposit paid",
      description: `$${(payment.amount_minor / 100).toLocaleString()}`,
      occurredAt: payment.transaction_date,
    });
  }

  for (const expense of input.expenses.filter((e) => e.category === "flowers")) {
    entries.push({
      id: `flowers-${expense.id}`,
      kind: "flowers_ordered",
      title: "Flowers ordered",
      description: expense.description,
      occurredAt: expense.transaction_date,
    });
  }

  for (const movement of input.inventoryMovements.filter((m) => m.movement_type === "reservation" || m.movement_type === "event_checkout")) {
    entries.push({
      id: `inventory-${movement.id}`,
      kind: "inventory_reserved",
      title: "Inventory reserved",
      description: movement.reason,
      occurredAt: movement.occurred_at,
    });
  }

  for (const assignment of input.vendorAssignments.filter((a) => a.status === "confirmed")) {
    entries.push({
      id: `vendor-${assignment.id}`,
      kind: "vendor_assigned",
      title: "Vendor assigned",
      description: assignment.note,
      occurredAt: assignment.updated_at,
    });
  }

  for (const requirement of input.teamRequirements.filter((r) => r.assigned_member_id !== null)) {
    entries.push({
      id: `team-${requirement.id}`,
      kind: "team_assigned",
      title: `Team assigned — ${requirement.role_label}`,
      description: requirement.note,
      occurredAt: requirement.updated_at,
    });
  }

  const setupItem = input.schedule.find((item) => item.category === "setup" && item.status === "completed");
  if (setupItem) {
    entries.push({
      id: `setup-${setupItem.id}`,
      kind: "setup_started",
      title: "Setup started",
      description: setupItem.title,
      occurredAt: `${input.event.event_date ?? ""}T${setupItem.start_time ?? "00:00"}`,
    });
  }

  const clientArrivalLog = input.liveEventLog.find((log) => log.kind === "check_in" && log.note?.toLowerCase().includes("client"));
  if (clientArrivalLog) {
    entries.push({
      id: `client-arrived-${clientArrivalLog.id}`,
      kind: "client_arrived",
      title: "Client arrived",
      description: clientArrivalLog.note,
      occurredAt: clientArrivalLog.occurred_at,
    });
  }

  if (input.event.completed_at) {
    entries.push({
      id: `completed-${input.event.id}`,
      kind: "event_completed",
      title: "Event completed",
      description: null,
      occurredAt: input.event.completed_at,
    });
  }

  const firstGalleryAsset = [...input.galleryAssets].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (firstGalleryAsset) {
    entries.push({
      id: `gallery-${firstGalleryAsset.id}`,
      kind: "gallery_delivered",
      title: "Gallery delivered",
      description: firstGalleryAsset.original_filename,
      occurredAt: firstGalleryAsset.created_at,
    });
  }

  const reviewLog = input.liveEventLog.find((log) => log.kind === "note" && log.note?.toLowerCase().includes("review"));
  if (reviewLog) {
    entries.push({
      id: `review-${reviewLog.id}`,
      kind: "review_received",
      title: "Review received",
      description: reviewLog.note,
      occurredAt: reviewLog.occurred_at,
    });
  }

  return entries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
