import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AssignmentStatusBadge } from "@/modules/services/components/AssignmentStatusBadge";
import { FulfillmentSummaryStrip } from "@/modules/services/components/FulfillmentSummaryStrip";
import type { EventService } from "@/types/eventService";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { ServiceVersion } from "@/types/serviceVersion";

interface WorkspaceHeaderProps {
  eventService: EventService;
  event: Event;
  client: Client;
  version: ServiceVersion;
  team: EventServiceTeamRequirement[];
  fulfillmentSummary: { resolved: number; total: number };
  /** Rendered inline as the header's "Quick actions" slot — `WorkspaceActions` is the one place every operational/navigation button lives, so the header never duplicates that logic. */
  actions: ReactNode;
}

/**
 * No "Health" stat here, deliberately — `getServiceHealth` is hard-scoped to
 * a catalog Service's current draft version and has no concept of an
 * arbitrary EventService's pinned version, so a genuine assignment-scoped
 * health value doesn't exist anywhere in the domain (the same reasoning
 * `AssignmentDetailPanel`'s own doc comment already states). Completion —
 * the one real per-assignment signal that does exist — covers that ground
 * instead of a fabricated second percentage.
 */
export function WorkspaceHeader({ eventService, event, client, version, team, fulfillmentSummary, actions }: WorkspaceHeaderProps) {
  const teamAssigned = team.filter((requirement) => requirement.assigned_member_id !== null).length;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[19px] font-semibold text-text">
            <Link href={`/events/${event.id}`} className="hover:text-accent hover:underline">
              {event.title}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            <Link href={`/clients/${client.id}`} className="hover:text-accent hover:underline">
              {client.first_name} {client.last_name}
            </Link>
          </p>
        </div>
        <AssignmentStatusBadge status={eventService.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-text-muted">Scheduled</dt>
          <dd className="text-text">
            {event.event_date ? new Date(event.event_date).toLocaleDateString() : "Not yet scheduled"}
            {event.start_time ? ` · ${event.start_time}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Assigned version</dt>
          <dd className="text-text">{version.version_number !== null ? `Version ${version.version_number}` : "Draft"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Assigned team</dt>
          <dd className="text-text">
            {team.length === 0 ? "No roles required" : `${teamAssigned} of ${team.length} assigned`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Completion</dt>
          <dd className="text-text">
            {fulfillmentSummary.resolved} of {fulfillmentSummary.total}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <FulfillmentSummaryStrip resolved={fulfillmentSummary.resolved} total={fulfillmentSummary.total} />
      </div>

      <div className="mt-4 border-t border-border pt-4">{actions}</div>
    </Card>
  );
}
