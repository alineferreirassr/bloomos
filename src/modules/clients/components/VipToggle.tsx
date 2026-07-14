"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { setClientVipStatus } from "@/lib/data";

interface VipToggleProps {
  clientId: string;
  isVip: boolean;
  onChanged: (isVip: boolean) => void;
}

export function VipToggle({ clientId, isVip, onChanged }: VipToggleProps) {
  const [optimisticVip, setOptimisticVip] = useState(isVip);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const previous = optimisticVip;
    const next = !optimisticVip;
    setOptimisticVip(next);
    setPending(true);
    setError(null);
    const result = await setClientVipStatus(clientId, next);
    setPending(false);
    if (!result.success) {
      setOptimisticVip(previous);
      setError(result.error);
      return;
    }
    onChanged(next);
  };

  return (
    <div>
      <Button variant="secondary" onClick={toggle} disabled={pending} aria-pressed={optimisticVip}>
        {optimisticVip ? "Remove VIP" : "Mark as VIP"}
      </Button>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
