"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { reverseJournalEntry } from "@/lib/data";
import type { JournalEntry } from "@/types/journalEntry";

interface ReverseJournalEntryDialogProps {
  open: boolean;
  onClose: () => void;
  journalEntryId: string;
  onReversed: (reversal: JournalEntry) => void;
}

/** Calls reverseJournalEntry directly — never updates the original entry itself; the confirmation copy explains that a new, separate reversing entry is created instead. */
export function ReverseJournalEntryDialog({ open, onClose, journalEntryId, onReversed }: ReverseJournalEntryDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (submitting) return;
    setReason("");
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (reason.trim() === "") {
      setError("A reversal reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await reverseJournalEntry(journalEntryId, { reason: reason.trim() });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setReason("");
    onReversed(result.data);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Reverse Journal Entry">
      <div className="space-y-3 text-sm text-text-muted">
        <p>This creates a new reversing entry with every line&apos;s debit and credit swapped.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>The original entry remains unchanged — it is never edited or removed.</li>
          <li>A brand-new Journal Entry is created and linked to it in both directions.</li>
          <li>This action cannot be undone through direct editing.</li>
        </ul>
      </div>

      <div className="mt-4">
        <label htmlFor="reversal-reason" className="mb-[5px] block text-xs text-text/70">
          Reversal reason<span className="text-accent"> *</span>
        </label>
        <Textarea
          id="reversal-reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          invalid={!!error}
          disabled={submitting}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Reversing…" : "Reverse Entry"}
        </Button>
        <Button variant="secondary" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
