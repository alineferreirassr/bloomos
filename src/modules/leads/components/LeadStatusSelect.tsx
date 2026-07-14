"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import {
  LEAD_STATUS_LABELS,
  getNextStatuses,
  isTerminalStatus,
  type LeadStatus,
} from "@/core/workflows/leadWorkflow";
import { updateLeadStatus } from "@/lib/data";

interface LeadStatusSelectProps {
  leadId: string;
  status: LeadStatus;
  onChanged: () => void;
}

export function LeadStatusSelect({ leadId, status, onChanged }: LeadStatusSelectProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = isTerminalStatus(status);
  const options = [status, ...getNextStatuses(status)];

  const handleChange = async (next: LeadStatus) => {
    if (next === status) return;
    setPending(true);
    setError(null);
    const result = await updateLeadStatus(leadId, next);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  if (locked) {
    return <p className="text-sm text-text">{LEAD_STATUS_LABELS[status]}</p>;
  }

  return (
    <div>
      <Select
        value={status}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value as LeadStatus)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {LEAD_STATUS_LABELS[option]}
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
