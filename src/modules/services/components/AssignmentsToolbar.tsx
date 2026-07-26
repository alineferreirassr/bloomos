interface AssignmentsToolbarProps {
  resultCount: number;
  className?: string;
}

export function AssignmentsToolbar({ resultCount, className = "" }: AssignmentsToolbarProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <p className="text-sm text-text-muted" aria-live="polite">
        {resultCount} {resultCount === 1 ? "Assignment" : "Assignments"}
      </p>
    </div>
  );
}
