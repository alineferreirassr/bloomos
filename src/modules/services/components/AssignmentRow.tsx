import { memo } from "react";
import { TableRow, TableCell } from "@/components/ui/Table";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { AssignmentStatusBadge } from "@/modules/services/components/AssignmentStatusBadge";
import type { ServiceAssignmentRow } from "@/lib/queries/services/types";

interface AssignmentRowProps {
  row: ServiceAssignmentRow;
  selected: boolean;
  onSelect: (row: ServiceAssignmentRow) => void;
}

function overrideStateLabel(row: ServiceAssignmentRow): string {
  if (row.isNameOverridden && row.isPriceOverridden) return "Name & price overridden";
  if (row.isNameOverridden) return "Name overridden";
  if (row.isPriceOverridden) return "Price overridden";
  return "Default";
}

/**
 * Memoized — one Service can have dozens of assignments, and selecting a
 * different row (or editing an override, which only ever changes the
 * SELECTED row's own data) should never force every other row to
 * re-render.
 */
export const AssignmentRow = memo(function AssignmentRow({ row, selected, onSelect }: AssignmentRowProps) {
  const { eventService, event, client, versionNumber, team, completion } = row;
  const actions: ActionMenuAction[] = [{ label: "View details", onSelect: () => onSelect(row) }];

  return (
    <TableRow selected={selected}>
      <TableCell>
        <button type="button" onClick={() => onSelect(row)} className="text-left font-serif font-semibold text-text underline-offset-2 hover:underline">
          {event.title}
        </button>
      </TableCell>
      <TableCell>
        {client.first_name} {client.last_name}
      </TableCell>
      <TableCell>{event.event_date ? new Date(event.event_date).toLocaleDateString() : "—"}</TableCell>
      <TableCell>
        <AssignmentStatusBadge status={eventService.status} />
      </TableCell>
      <TableCell>{versionNumber !== null ? `Version ${versionNumber}` : "—"}</TableCell>
      <TableCell>{team.total > 0 ? `${team.resolved} of ${team.total}` : "No team required"}</TableCell>
      <TableCell>{overrideStateLabel(row)}</TableCell>
      <TableCell className="min-w-[140px]">
        <ProgressBar value={completion.total > 0 ? (completion.resolved / completion.total) * 100 : 100} label={`Completion for ${event.title}`} />
      </TableCell>
      <TableCell>
        <ActionMenu actions={actions} />
      </TableCell>
    </TableRow>
  );
});
