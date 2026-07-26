import { EmptyState } from "@/components/ui/EmptyState";

/** Distinct from "no rows match the current filters" — that case is handled inline by `ServiceAssignmentsPage` itself, since it needs to offer a "Clear filters" action this component has no filter state to reset. */
export function AssignmentEmptyState() {
  return <EmptyState title="No assignments yet" description="This Service hasn't been assigned to any Event yet." />;
}
