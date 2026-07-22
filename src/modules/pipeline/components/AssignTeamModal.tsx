"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateLead } from "@/lib/data";
import { leadToFormInput } from "@/modules/pipeline/logic";
import type { Lead } from "@/types/lead";

interface AssignTeamModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onAssigned: (lead: Lead) => void;
}

/**
 * Leads has no dedicated partial-update endpoint — updateLead() takes the
 * full LeadFormInput, so this resubmits every existing field unchanged
 * except assigned_to (leadToFormInput does the null->"" conversion the form
 * shape expects).
 */
export function AssignTeamModal({ lead, open, onClose, onAssigned }: AssignTeamModalProps) {
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await updateLead(lead.id, { ...leadToFormInput(lead), assigned_to: assignedTo });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onAssigned(result.data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Assign Team">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-text-muted">Assigned to</span>
        <Input
          value={assignedTo}
          onChange={(event) => setAssignedTo(event.target.value)}
          placeholder="Team member name"
          disabled={submitting}
        />
      </label>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
