"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { updateEventPriority } from "@/lib/data";
import { EVENT_PRIORITIES, EVENT_PRIORITY_LABELS, type EventPriority } from "@/core/enums/eventPriority";

interface EventPrioritySelectProps {
  eventId: string;
  priority: EventPriority;
  onChanged: (priority: EventPriority) => void;
}

/** Priority has no transition rule — any tier can move to any other, unlike status/lifecycle. */
export function EventPrioritySelect({ eventId, priority, onChanged }: EventPrioritySelectProps) {
  const [optimisticPriority, setOptimisticPriority] = useState(priority);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (next: EventPriority) => {
    if (next === optimisticPriority) return;
    const previous = optimisticPriority;
    setOptimisticPriority(next);
    setPending(true);
    setError(null);
    try {
      const result = await updateEventPriority(eventId, next);
      if (!result.success) {
        setOptimisticPriority(previous);
        setError(result.error);
        return;
      }
      onChanged(next);
    } catch (err) {
      setOptimisticPriority(previous);
      setError(err instanceof Error ? err.message : "Could not update priority. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <Select
        aria-label="Event priority"
        value={optimisticPriority}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value as EventPriority)}
      >
        {EVENT_PRIORITIES.map((option) => (
          <option key={option} value={option}>
            {EVENT_PRIORITY_LABELS[option]}
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
