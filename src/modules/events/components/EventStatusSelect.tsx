"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { updateEventStatus } from "@/lib/data";
import { EVENT_STATUS_LABELS, type EventStatus } from "@/core/enums/eventStatus";
import { getNextEventStatuses, isEventTerminal } from "@/core/workflows/eventWorkflow";

interface EventStatusSelectProps {
  eventId: string;
  status: EventStatus;
  onChanged: (status: EventStatus) => void;
}

/**
 * Options come from getNextEventStatuses() (core/workflows/eventWorkflow.ts)
 * — never a hardcoded list — so this always reflects the current transition
 * rules. completed/cancelled/archived are terminal and reachable only via
 * their own dedicated action, never this selector.
 */
export function EventStatusSelect({ eventId, status, onChanged }: EventStatusSelectProps) {
  const [optimisticStatus, setOptimisticStatus] = useState(status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isEventTerminal(status)) {
    return <p className="text-sm text-text">{EVENT_STATUS_LABELS[status]}</p>;
  }

  const selectableStatuses = [optimisticStatus, ...getNextEventStatuses(optimisticStatus)];

  const handleChange = async (next: EventStatus) => {
    if (next === optimisticStatus) return;
    const previous = optimisticStatus;
    setOptimisticStatus(next);
    setPending(true);
    setError(null);
    try {
      const result = await updateEventStatus(eventId, next);
      if (!result.success) {
        setOptimisticStatus(previous);
        setError(result.error);
        return;
      }
      onChanged(next);
    } catch (err) {
      setOptimisticStatus(previous);
      setError(err instanceof Error ? err.message : "Could not update status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <Select
        aria-label="Event status"
        value={optimisticStatus}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value as EventStatus)}
      >
        {selectableStatuses.map((option) => (
          <option key={option} value={option}>
            {EVENT_STATUS_LABELS[option]}
          </option>
        ))}
      </Select>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
