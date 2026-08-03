"use client";

import { useMemo, useState, useCallback } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { useServiceAssignments } from "@/modules/services/hooks/useServiceAssignments";
import { AssignmentLoadingState } from "@/modules/services/components/AssignmentLoadingState";
import { AssignmentEmptyState } from "@/modules/services/components/AssignmentEmptyState";
import { AssignmentsToolbar } from "@/modules/services/components/AssignmentsToolbar";
import { AssignmentsFilters } from "@/modules/services/components/AssignmentsFilters";
import { AssignmentsTable } from "@/modules/services/components/AssignmentsTable";
import { AssignmentDetailPanel } from "@/modules/services/components/AssignmentDetailPanel";
import { AssignmentSidebar } from "@/modules/services/components/AssignmentSidebar";
import { DEFAULT_ASSIGNMENT_FILTERS, filterAssignmentRows, sortAssignmentsUpcomingFirst, type AssignmentFiltersValue } from "@/modules/services/assignmentFiltering";
import type { ServiceAssignmentRow } from "@/lib/queries/services/types";

interface ServiceAssignmentsPageProps {
  serviceId: string;
}

/**
 * Entirely read-only aside from `AssignmentOverridesCard`'s existing
 * override mutation — this page only ever calls `useServiceAssignments`
 * (plus, lazily, `useEventServiceWorkspace` for whichever single
 * assignment is selected, inside `AssignmentDetailPanel`). Filtering and
 * sorting both happen here, in-memory, over the one fetched result — no
 * filter interaction ever triggers a new request.
 */
export function ServiceAssignmentsPage({ serviceId }: ServiceAssignmentsPageProps) {
  const query = useServiceAssignments(serviceId);
  const [now] = useState(() => new Date());
  const [filters, setFilters] = useState<AssignmentFiltersValue>(DEFAULT_ASSIGNMENT_FILTERS);
  const [selectedEventServiceId, setSelectedEventServiceId] = useState<string | null>(null);

  const sortedRows = useMemo(() => (query.data ? sortAssignmentsUpcomingFirst(query.data.rows, now) : []), [query.data, now]);
  const filteredRows = useMemo(() => filterAssignmentRows(sortedRows, filters, now), [sortedRows, filters, now]);
  const availableVersionNumbers = useMemo(
    () => Array.from(new Set(sortedRows.map((row) => row.versionNumber).filter((value): value is number => value !== null))).sort((a, b) => b - a),
    [sortedRows],
  );

  const handleSelect = useCallback((row: ServiceAssignmentRow) => {
    setSelectedEventServiceId(row.eventService.id);
  }, []);

  if (query.status === "pending") {
    return <AssignmentLoadingState />;
  }

  if (query.status === "error") {
    return <ErrorState message="We couldn't load this Service's assignments." onRetry={() => query.refetch()} />;
  }

  if (sortedRows.length === 0) {
    return <AssignmentEmptyState />;
  }

  const selectedRow = filteredRows.find((row) => row.eventService.id === selectedEventServiceId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="space-y-4 lg:col-span-3">
        <AssignmentsToolbar resultCount={filteredRows.length} />
        <AssignmentsFilters value={filters} onChange={setFilters} availableVersionNumbers={availableVersionNumbers} />
        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm text-text/55">No assignments match the current filters.</p>
            <Button type="button" variant="secondary" onClick={() => setFilters(DEFAULT_ASSIGNMENT_FILTERS)}>
              Clear filters
            </Button>
          </div>
        ) : (
          <AssignmentsTable rows={filteredRows} selectedEventServiceId={selectedEventServiceId} onSelect={handleSelect} />
        )}
        {selectedRow ? <AssignmentDetailPanel row={selectedRow} serviceId={serviceId} /> : null}
      </div>
      <div>
        <AssignmentSidebar rows={sortedRows} onFiltersChange={setFilters} now={now} />
      </div>
    </div>
  );
}
