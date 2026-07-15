"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { updateContractStatus } from "@/lib/data";
import { CONTRACT_STATUS_LABELS, type ContractStatus } from "@/core/enums/contractStatus";
import { getNextContractStatuses, isContractStatusTerminal } from "@/core/workflows/contractWorkflow";

interface ContractStatusSelectProps {
  contractId: string;
  status: ContractStatus;
  onChanged: (status: ContractStatus) => void;
}

/**
 * Options come from getNextContractStatuses() (core/workflows/
 * contractWorkflow.ts) — never a hardcoded list. Only reachable while status
 * is draft/review/ready; every other status is locked to its own dedicated
 * action (Send/Mark Viewed/Mark Signed/etc. in ContractActions), so this
 * component renders nothing once isContractStatusTerminal(status) is true.
 */
export function ContractStatusSelect({ contractId, status, onChanged }: ContractStatusSelectProps) {
  const [optimisticStatus, setOptimisticStatus] = useState(status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isContractStatusTerminal(status)) {
    return null;
  }

  const selectableStatuses = [optimisticStatus, ...getNextContractStatuses(optimisticStatus)];

  const handleChange = async (next: ContractStatus) => {
    if (next === optimisticStatus) return;
    const previous = optimisticStatus;
    setOptimisticStatus(next);
    setPending(true);
    setError(null);
    const result = await updateContractStatus(contractId, next);
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
        aria-label="Contract status"
        value={optimisticStatus}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value as ContractStatus)}
      >
        {selectableStatuses.map((option) => (
          <option key={option} value={option}>
            {CONTRACT_STATUS_LABELS[option]}
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
