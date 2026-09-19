"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateLeadAssignment } from "@/lib/data";
import type { Lead } from "@/types/lead";

interface AssignTeamModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onAssigned: (lead: Lead) => void;
}

/**
 * SOCIAL-13E — uses `updateLeadAssignment()`, an isolated, single-field
 * update that bypasses `leadFormSchema`/`leadDataSchema` entirely
 * (previously this resubmitted the full `LeadFormInput` via `updateLead()`,
 * which required a non-empty name and email on every save — impossible for
 * an Instagram-originated Lead before a human backfills the rest). Still
 * the same free-text input, still no real member picker — the existing
 * `assigned_to` semantics are otherwise completely unchanged.
 */
export function AssignTeamModal({ lead, open, onClose, onAssigned }: AssignTeamModalProps) {
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await updateLeadAssignment(lead.workspace_id, lead.id, assignedTo);
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
        <p role="alert" className="mt-3 text-sm text-danger">
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
