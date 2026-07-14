"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { convertLeadToClient } from "@/lib/data";
import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";

interface ConvertToClientModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onConverted: (lead: Lead, client: Client) => void;
}

export function ConvertToClientModal({
  lead,
  open,
  onClose,
  onConverted,
}: ConvertToClientModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await convertLeadToClient(lead.id);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onConverted(result.data.lead, result.data.client);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Convert Lead to Client">
      <p className="text-sm text-text-muted">
        This creates a Client record for <strong className="text-text">{lead.first_name} {lead.last_name}</strong>,
        keeps this Lead&apos;s notes and timeline history intact, and marks it read-only.
        This can&apos;t be undone.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Converting…" : "Convert to Client"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
