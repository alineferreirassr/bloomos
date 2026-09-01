"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { applyDefaultFolderTemplateAction as applyDefaultFolderTemplate } from "@/modules/documents/documentActions";
import { FOLDER_TEMPLATE_KINDS, type FolderTemplateKind } from "@/modules/documents/constants/folderTemplates";
import type { DocumentFolder } from "@/types/documentFolder";

interface ApplyFolderTemplateModalProps {
  open: boolean;
  onClose: () => void;
  folder: DocumentFolder;
  onApplied: (folders: DocumentFolder[]) => void;
}

const TEMPLATE_LABELS: Record<FolderTemplateKind, string> = {
  client: "Client",
  event: "Event",
  contract: "Contract",
  finance: "Finance",
};

/**
 * Applies a default folder template as one atomic batch (applyDefaultFolderTemplate,
 * lib/data/index.ts) nested under this folder. Shows one summarized success
 * message listing every folder created — never one notification per folder,
 * matching the single summarized Timeline entry the data layer already records.
 */
export function ApplyFolderTemplateModal({ open, onClose, folder, onApplied }: ApplyFolderTemplateModalProps) {
  const [templateKind, setTemplateKind] = useState<FolderTemplateKind>("client");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleClose = () => {
    setSuccessMessage(null);
    setError(null);
    onClose();
  };

  const handleApply = async () => {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    const result = await applyDefaultFolderTemplate({
      ownerType: folder.owner_type,
      ownerId: folder.owner_id,
      templateKind,
      parentFolderId: folder.id,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccessMessage(
      `Created ${result.data.length} folder${result.data.length === 1 ? "" : "s"}: ${result.data.map((f) => f.name).join(", ")}.`,
    );
    onApplied(result.data);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Apply Default Folder Template">
      <p className="text-sm text-text-muted">
        Creates a set of subfolders under &quot;{folder.name}&quot; in one atomic batch. Applying the same template
        twice creates a second set — it does not detect or skip duplicates by name.
      </p>
      <div className="mt-4">
        <FormField label="Template" htmlFor="template_kind">
          <Select id="template_kind" value={templateKind} onChange={(event) => setTemplateKind(event.target.value as FolderTemplateKind)}>
            {FOLDER_TEMPLATE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {TEMPLATE_LABELS[kind]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {successMessage ? <p className="mt-3 text-sm text-accent">{successMessage}</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleApply} disabled={submitting}>
          {submitting ? "Applying…" : "Apply Template"}
        </Button>
        <Button variant="secondary" onClick={handleClose} disabled={submitting}>
          {successMessage ? "Done" : "Cancel"}
        </Button>
      </div>
    </Modal>
  );
}
