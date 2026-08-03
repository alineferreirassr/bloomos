interface ServiceUsageCountProps {
  count: number;
  className?: string;
}

/** Presentation-only — the caller supplies the already-computed usage count (see getServiceUsageCounts in the query layer); this component never fetches or derives it. */
export function ServiceUsageCount({ count, className = "" }: ServiceUsageCountProps) {
  const unit = count === 1 ? "Event" : "Events";
  return (
    <span className={className} aria-label={`${count} ${count === 1 ? "event" : "events"}`}>
      {count === 0 ? "Not assigned" : `${count} ${unit}`}
    </span>
  );
}
