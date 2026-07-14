"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { CONTACT_METHODS, CONTACT_METHOD_LABELS, type ContactMethod } from "@/core/enums/contactMethod";
import { updateClientContactPreference } from "@/lib/data";

interface ContactMethodSelectProps {
  clientId: string;
  method: ContactMethod | null;
  onChanged: (method: ContactMethod | null) => void;
}

export function ContactMethodSelect({ clientId, method, onChanged }: ContactMethodSelectProps) {
  const [optimisticMethod, setOptimisticMethod] = useState<ContactMethod | "">(method ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (value: string) => {
    const next = value === "" ? null : (value as ContactMethod);
    const previous = optimisticMethod;
    setOptimisticMethod(value as ContactMethod | "");
    setPending(true);
    setError(null);
    const result = await updateClientContactPreference(clientId, next);
    setPending(false);
    if (!result.success) {
      setOptimisticMethod(previous);
      setError(result.error);
      return;
    }
    onChanged(next);
  };

  return (
    <div>
      <Select
        aria-label="Preferred contact method"
        value={optimisticMethod}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value)}
      >
        <option value="">Not set</option>
        {CONTACT_METHODS.map((option) => (
          <option key={option} value={option}>
            {CONTACT_METHOD_LABELS[option]}
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
