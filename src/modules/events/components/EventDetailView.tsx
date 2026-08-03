"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  createEventNote,
  getChecklistByEventId,
  getClientById,
  getContracts,
  getEventById,
  getEventFinancialStatus,
  getEventFinancialSummary,
  getEventNextAction,
  getNotesByEventId,
  getScheduleByEventId,
  getTimelineByEventId,
  listEventServicesByEvent,
  togglePinNote,
} from "@/lib/data";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { Contract } from "@/types/contract";
import type { EventService } from "@/types/eventService";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NotesSection } from "@/modules/notes/components/NotesSection";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { EntityTimelinePanel } from "@/modules/communication/timeline/components/EntityTimelinePanel";
import { CommentsPanel } from "@/modules/communication/comments/components/CommentsPanel";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import { getEventHealthDetails, type EventHealthDetails } from "@/core/workflows/eventHealth";
import { computeChecklistStats } from "@/modules/events/checklistStats";
import { computeScheduleStats } from "@/modules/events/scheduleStats";
import { formatEventDate } from "@/modules/events/dateFormat";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import { EventLifecycleBadge } from "@/modules/events/components/EventLifecycleBadge";
import { EventPriorityBadge } from "@/modules/events/components/EventPriorityBadge";
import { EventActions } from "@/modules/events/components/EventActions";
import { EventArchivedBanner } from "@/modules/events/components/EventArchivedBanner";
import { EventHealthCard } from "@/modules/events/components/EventHealthCard";
import { ChecklistSummaryCard } from "@/modules/events/components/ChecklistSummaryCard";
import { ScheduleSummaryCard } from "@/modules/events/components/ScheduleSummaryCard";
import { EventFinancialSummaryCard } from "@/modules/finance/components/EventFinancialSummaryCard";
import { EventContractsSummaryCard } from "@/modules/contracts/components/EventContractsSummaryCard";
import { EventAssignedServicesCard } from "@/modules/services/components/EventAssignedServicesCard";
import { DocumentsSummarySection } from "@/modules/documents/components/DocumentsSummarySection";
import { EventOperationsBriefSection } from "@/modules/ai/components/EventOperationsBriefSection";
import { ProposalGeneratorPanel } from "@/modules/ai/proposal/components/ProposalGeneratorPanel";
import { BloomAISkillPicker } from "@/modules/ai/components/BloomAISkillPicker";
import { useSetCopilotPageContext } from "@/modules/ai/copilot/CopilotPageContextProvider";
import { EventAssistantCard } from "@/modules/ai/copilot/assistants/EventAssistantCard";
import { EventCommandCenter } from "@/modules/operations/components/EventCommandCenter";
import { OperationsAssistantCard } from "@/modules/ai/copilot/assistants/OperationsAssistantCard";
import type { EventFinancialSummary } from "@/modules/finance/financialSummary";
import type { EventFinancialStatus } from "@/modules/finance/eventFinancialStatus";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "ready";
      event: Event;
      client: Client | null;
      notes: Note[];
      timeline: TimelineActivity[];
      checklist: ChecklistItem[];
      schedule: EventScheduleItem[];
      nextAction: string | null;
      health: EventHealthDetails;
      financialSummary: EventFinancialSummary;
      financialStatus: EventFinancialStatus;
      contracts: Contract[];
      assignedServices: EventService[];
    };

/**
 * daysUntilEvent (and therefore the health score) is computed here, at
 * fetch time, rather than inline in the component body — calling Date.now()
 * during render would make the component non-idempotent, which the
 * react-hooks/purity rule (correctly) rejects.
 */
async function loadEventDetail(eventId: string): Promise<LoadState> {
  try {
    const event = await getEventById(eventId);
    const [client, notes, timeline, checklist, schedule, nextAction, financialSummary, financialStatus, contracts, assignedServices] =
      await Promise.all([
        getClientById(event.client_id).catch(() => null),
        getNotesByEventId(eventId),
        getTimelineByEventId(eventId),
        getChecklistByEventId(eventId),
        getScheduleByEventId(eventId),
        getEventNextAction(eventId),
        getEventFinancialSummary(eventId),
        getEventFinancialStatus(eventId),
        getContracts({ eventId }),
        listEventServicesByEvent(eventId),
      ]);

    const checklistStats = computeChecklistStats(checklist);
    // event_date is a "YYYY-MM-DD" date-only string — new Date(event_date)
    // parses as UTC midnight, so comparing it against Date.now() shifts the
    // result by a day for any user in a timezone behind UTC (same class of
    // bug as dateFormat.ts's formatEventDate). Both sides are constructed
    // from local calendar components instead, so this always compares
    // "local midnight of the event date" to "local midnight of today."
    const daysUntilEvent = event.event_date
      ? (() => {
          const [year, month, day] = event.event_date.split("-").map(Number);
          const eventMidnight = new Date(year, month - 1, day).getTime();
          const todayMidnight = new Date().setHours(0, 0, 0, 0);
          return Math.round((eventMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
        })()
      : null;
    const health = getEventHealthDetails(
      {
        status: event.status,
        priority: event.priority,
        location_name: event.location_name,
        address: event.address,
        budget_min: event.budget_min,
        budget_max: event.budget_max,
      },
      {
        hasChecklistItems: checklist.length > 0,
        hasOverdueChecklistItems: checklistStats.overdue > 0,
        hasScheduleItems: schedule.length > 0,
        hasPostEventReview: false,
        daysUntilEvent,
      },
    );

    return {
      status: "ready",
      event,
      client,
      notes,
      timeline,
      checklist,
      schedule,
      nextAction,
      health,
      financialSummary,
      financialStatus,
      contracts,
      assignedServices,
    };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function EventDetailView({ eventId }: { eventId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  useSetCopilotPageContext(
    state.status === "ready" ? { module: "events", entity: { type: "event", id: state.event.id, label: state.event.title } } : { module: "events", entity: null },
  );

  useEffect(() => {
    let cancelled = false;
    loadEventDetail(eventId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Same rationale as ClientDetailView/LeadDetailView: keep the current tree
  // mounted while a refetch runs in the background, so local feedback (e.g.
  // quick-action errors) isn't unmounted before the user sees it.
  const refetch = () => {
    loadEventDetail(eventId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This event could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this event." onRetry={refetch} />;
  }

  const { event, client, notes, timeline, checklist, schedule, nextAction, health, financialSummary, financialStatus, contracts, assignedServices } =
    state;

  const checklistStats = computeChecklistStats(checklist);
  const scheduleStats = computeScheduleStats(schedule);

  // Per the Phase 2 spec: archived/cancelled Events lock Notes read-only;
  // completed Events explicitly keep Notes open for post-event write-ups.
  const notesReadOnly = event.status === "archived" || event.status === "cancelled";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-3xl font-semibold text-text">{event.title}</h2>
          <EventStatusBadge status={event.status} />
          <EventLifecycleBadge stage={event.lifecycle_stage} />
          <EventPriorityBadge priority={event.priority} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {EVENT_TYPE_LABELS[event.event_type]}
          {client ? (
            <>
              {" · "}
              <Link href={`/clients/${client.id}`} className="text-accent hover:underline">
                {client.first_name} {client.last_name}
              </Link>
            </>
          ) : null}
          {event.event_date ? ` · ${formatEventDate(event.event_date)}` : ""}
          {event.location_name ? ` · ${event.location_name}` : event.city ? ` · ${event.city}` : ""}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <EventActions event={event} onChanged={refetch} />
          <BloomAISkillPicker />
        </div>
      </div>

      {event.status === "archived" ? <EventArchivedBanner /> : null}

      {nextAction ? (
        <Card className="border-accent/40 bg-accent/5">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Next recommended action</p>
          <p className="mt-1 text-sm text-text">{nextAction}</p>
        </Card>
      ) : null}

      <EventCommandCenter eventId={event.id} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Event Summary</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Event type" value={EVENT_TYPE_LABELS[event.event_type]} />
              <Field label="Package" value={event.package_name} />
              <Field label="Assigned owner" value={event.assigned_owner} />
              <Field label="Created" value={new Date(event.created_at).toLocaleDateString()} />
              <Field label="Updated" value={new Date(event.updated_at).toLocaleDateString()} />
              {event.originating_lead_id ? (
                <Field
                  label="Originating Lead"
                  value={
                    <Link href={`/leads/${event.originating_lead_id}`} className="text-accent hover:underline">
                      View original Lead →
                    </Link>
                  }
                />
              ) : null}
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Client</h3>
            {client ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Name"
                  value={
                    <Link href={`/clients/${client.id}`} className="text-accent hover:underline">
                      {client.first_name} {client.last_name}
                    </Link>
                  }
                />
                <Field label="Email" value={client.email} />
                <Field label="Phone" value={client.phone} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">Client not found.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Date &amp; Time</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Event date" value={formatEventDate(event.event_date)} />
              <Field label="Start time" value={event.start_time} />
              <Field label="End time" value={event.end_time} />
              <Field label="Timezone" value={event.timezone} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Location</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Location name" value={event.location_name} />
              <Field label="Address" value={event.address} />
              <Field label="City" value={event.city} />
              <Field label="State" value={event.state} />
              <Field label="ZIP code" value={event.zip_code} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Budget, Package &amp; Guests</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Budget min" value={formatCurrency(event.budget_min)} />
              <Field label="Budget max" value={formatCurrency(event.budget_max)} />
              <Field label="Package" value={event.package_name} />
              <Field label="Guest count" value={event.guest_count === null ? null : String(event.guest_count)} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Theme &amp; Color Palette</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Theme" value={event.theme} />
              <Field label="Color palette" value={event.color_palette} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Surprise &amp; Confidentiality</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Surprise event" value={event.surprise_event ? "Yes" : "No"} />
              <Field label="Confidentiality notes" value={event.confidentiality_notes} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Accessibility &amp; Dietary Notes</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Accessibility notes" value={event.accessibility_notes} />
              <Field label="Dietary notes" value={event.dietary_notes} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Weather Plan &amp; Backup Location</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Weather plan" value={event.weather_plan} />
              <Field label="Backup location" value={event.backup_location} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Internal Summary</h3>
            <p className="mt-2 text-sm text-text">{event.internal_summary || "—"}</p>
          </Card>

          <EventOperationsBriefSection eventId={event.id} />

          <EventAssistantCard eventId={event.id} />

          <OperationsAssistantCard eventId={event.id} />

          <ProposalGeneratorPanel eventId={event.id} />

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
            <div className="mt-3">
              <NotesSection
                workspaceId={event.workspace_id}
                ownerType="event"
                ownerId={event.id}
                notes={notes}
                onCreateNote={(input) => createEventNote(event.id, input)}
                onTogglePin={togglePinNote}
                readOnly={notesReadOnly}
                onNotesChanged={refetch}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <EventHealthCard health={health} />
          <EventFinancialSummaryCard
            eventId={event.id}
            clientId={event.client_id}
            summary={financialSummary}
            status={financialStatus}
          />
          <ChecklistSummaryCard eventId={event.id} stats={checklistStats} />
          <ScheduleSummaryCard eventId={event.id} stats={scheduleStats} />
          <EventContractsSummaryCard contracts={contracts} />
          <EventAssignedServicesCard assignedServices={assignedServices} />
          <DocumentsSummarySection
            ownerType="event"
            ownerId={event.id}
            newDocumentParams={{ eventId: event.id, clientId: event.client_id }}
          />

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Timeline</h3>
            <div className="mt-3">
              <Timeline activities={timeline} />
            </div>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Communication Timeline</h3>
            <p className="mt-1 text-xs text-text-muted">Comments, notifications, and other activity for this event — v2 Checkpoint 24.</p>
            <div className="mt-3">
              <EntityTimelinePanel ownerType="event" ownerId={event.id} />
            </div>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Comments</h3>
            <div className="mt-3">
              <CommentsPanel ownerType="event" ownerId={event.id} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || "—"}</dd>
    </div>
  );
}

function formatCurrency(value: number | null): string | null {
  if (value === null) return null;
  return `$${value.toLocaleString()}`;
}
