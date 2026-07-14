"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS, type ClientStatus } from "@/core/enums/clientStatus";
import { updateClientStatus } from "@/lib/data";

/**
 * "archived" is deliberately excluded from the selectable options — it's
 * reached only through the dedicated Archive action, which also stamps
 * archived_at. Selecting it here would desync internal_status from
 * archived_at. Restore is the only way back to a plain status.
 */
const SELECTABLE_STATUSES = CLIENT_STATUSES.filter((status) => status !== "archived");

interface ClientStatusSelectProps {
  clientId: string;
  status: ClientStatus;
  onChanged: (status: ClientStatus) => void;
}

export function ClientStatusSelect({ clientId, status, onChanged }: ClientStatusSelectProps) {
  const [optimisticStatus, setOptimisticStatus] = useState(status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "archived") {
    return <p className="text-sm text-text">{CLIENT_STATUS_LABELS.archived}</p>;
  }

  const handleChange = async (next: ClientStatus) => {
    if (next === optimisticStatus) return;
    const previous = optimisticStatus;
    setOptimisticStatus(next);
    setPending(true);
    setError(null);
    const result = await updateClientStatus(clientId, next);
    setPending(false);
    if (!result.success) {
      setOptimisticStatus(previous);
      setError(result.error);
      return;
    }
    onChanged(next);
  };

  return (
    <div>
      <Select
        aria-label="Client status"
        value={optimisticStatus}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value as ClientStatus)}
      >
        {SELECTABLE_STATUSES.map((option) => (
          <option key={option} value={option}>
            {CLIENT_STATUS_LABELS[option]}
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
