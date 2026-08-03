import { Table, TableHead, TableBody, TableRow, TableHeaderCell } from "@/components/ui/Table";
import { AssignmentRow } from "@/modules/services/components/AssignmentRow";
import type { ServiceAssignmentRow } from "@/lib/queries/services/types";

interface AssignmentsTableProps {
  rows: ServiceAssignmentRow[];
  selectedEventServiceId: string | null;
  onSelect: (row: ServiceAssignmentRow) => void;
}

/** Read-only — no sortable columns, no bulk-selection checkboxes; the only per-row interaction is opening the detail panel, via either the Event name or the row's action menu. */
export function AssignmentsTable({ rows, selectedEventServiceId, onSelect }: AssignmentsTableProps) {
  return (
    <Table aria-label="Event assignments">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Event</TableHeaderCell>
          <TableHeaderCell>Client</TableHeaderCell>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Assigned version</TableHeaderCell>
          <TableHeaderCell>Assigned team</TableHeaderCell>
          <TableHeaderCell>Override state</TableHeaderCell>
          <TableHeaderCell>Completion</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <AssignmentRow key={row.eventService.id} row={row} selected={row.eventService.id === selectedEventServiceId} onSelect={onSelect} />
        ))}
      </TableBody>
    </Table>
  );
}
