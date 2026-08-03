import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AssignmentStatusBadge } from "@/modules/services/components/AssignmentStatusBadge";
import type { EventService } from "@/types/eventService";

interface EventAssignedServicesCardProps {
  assignedServices: EventService[];
}

/**
 * Read-only rollup on Event Detail — reuses `listEventServicesByEvent`
 * (already the Services module's own data source for its "already
 * assigned" checks) rather than a new query. Closes the previously
 * one-directional Event → Service Assignment → Workspace path: before this,
 * reaching a Workspace from an Event meant going Services catalog → guess
 * the right Service → its Assignments tab → find the matching row. Each
 * row here links straight to that exact assignment's Workspace.
 */
export function EventAssignedServicesCard({ assignedServices }: EventAssignedServicesCardProps) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Assigned Services</h3>
      {assignedServices.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No Services assigned to this event.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {assignedServices.map((eventService) => (
            <li key={eventService.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
              <Link
                href={`/services/${eventService.service_id}/assignments/${eventService.id}`}
                className="min-w-0 truncate text-text hover:text-accent hover:underline"
              >
                {eventService.name}
              </Link>
              <AssignmentStatusBadge status={eventService.status} />
            </li>
          ))}
        </ul>
      )}
      <Link href="/services">
        <Button variant="secondary" className="mt-4">
          Assign a Service
        </Button>
      </Link>
    </Card>
  );
}
