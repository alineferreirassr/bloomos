"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { updateEventLifecycleStage } from "@/lib/data";
import { EVENT_LIFECYCLE_STAGE_LABELS, type EventLifecycleStage } from "@/core/enums/eventLifecycleStage";
import { getNextLifecycleStages, isLifecycleStageTerminal } from "@/core/workflows/eventWorkflow";

interface EventLifecycleSelectProps {
  eventId: string;
  stage: EventLifecycleStage;
  onChanged: (stage: EventLifecycleStage) => void;
}

/**
 * Options come from getNextLifecycleStages() — never a hardcoded list.
 * "closed" is reachable through this same selector (there's no separate
 * dedicated close action) but can't be left once entered.
 */
export function EventLifecycleSelect({ eventId, stage, onChanged }: EventLifecycleSelectProps) {
  const [optimisticStage, setOptimisticStage] = useState(stage);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLifecycleStageTerminal(stage)) {
    return <p className="text-sm text-text">{EVENT_LIFECYCLE_STAGE_LABELS[stage]}</p>;
  }

  const selectableStages = [optimisticStage, ...getNextLifecycleStages(optimisticStage)];

  const handleChange = async (next: EventLifecycleStage) => {
    if (next === optimisticStage) return;
    const previous = optimisticStage;
    setOptimisticStage(next);
    setPending(true);
    setError(null);
    try {
      const result = await updateEventLifecycleStage(eventId, next);
      if (!result.success) {
        setOptimisticStage(previous);
        setError(result.error);
        return;
      }
      onChanged(next);
    } catch (err) {
      setOptimisticStage(previous);
      setError(err instanceof Error ? err.message : "Could not update lifecycle stage. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <Select
        aria-label="Event lifecycle stage"
        value={optimisticStage}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value as EventLifecycleStage)}
      >
        {selectableStages.map((option) => (
          <option key={option} value={option}>
            {EVENT_LIFECYCLE_STAGE_LABELS[option]}
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
