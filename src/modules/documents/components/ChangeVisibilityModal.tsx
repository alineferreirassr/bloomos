"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { updateDocumentVisibility } from "@/lib/data";
import { DOCUMENT_VISIBILITIES, DOCUMENT_VISIBILITY_LABELS, type DocumentVisibility } from "@/core/enums/documentVisibility";
import type { Document } from "@/types/document";

interface ChangeVisibilityModalProps {
  open: boolean;
  onClose: () => void;
  document: Document;
  onChanged: (document: Document) => void;
}

export function ChangeVisibilityModal({ open, onClose, document, onChanged }: ChangeVisibilityModalProps) {
  const [visibility, setVisibility] = useState<DocumentVisibility>(document.visibility);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await updateDocumentVisibility(document.id, visibility);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onChanged(result.data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Change Visibility">
      <p className="text-sm text-text-muted">
        Presentation only in this phase — no authentication or access enforcement reads this value yet.
      </p>
      <div className="mt-4">
        <FormField label="Visibility" htmlFor="change_visibility">
          <Select
            id="change_visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as DocumentVisibility)}
          >
            {DOCUMENT_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {DOCUMENT_VISIBILITY_LABELS[v]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={submitting || visibility === document.visibility}>
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
