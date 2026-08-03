"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { createTemplateAction } from "@/modules/documentTemplates/createTemplateAction";
import type { DocumentTypeDefinition } from "@/types/documentPlatform";

interface NewTemplateModalProps {
  open: boolean;
  onClose: () => void;
  documentTypes: DocumentTypeDefinition[];
  onCreated: (templateId: string) => void;
}

export function NewTemplateModal({ open, onClose, documentTypes, onCreated }: NewTemplateModalProps) {
  const [documentTypeId, setDocumentTypeId] = useState(documentTypes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    const result = await createTemplateAction(documentTypeId, name, description);
    setCreating(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setName("");
    setDescription("");
    setError(null);
    onCreated(result.templateId);
  }

  return (
    <Modal open={open} onClose={onClose} title="New Template">
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-text/55" htmlFor="new-template-type">
            Document Type
          </label>
          <Select id="new-template-type" value={documentTypeId} onChange={(event) => setDocumentTypeId(event.target.value)}>
            {documentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </Select>
        </div>
        <Input value={name} placeholder="Template name" onChange={(event) => setName(event.target.value)} />
        <Textarea value={description} placeholder="Description (optional)" onChange={(event) => setDescription(event.target.value)} />
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
