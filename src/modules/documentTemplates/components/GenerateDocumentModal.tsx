"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { getGenerateDocumentPickerData, type GenerateDocumentPickerData } from "@/modules/documentTemplates/getGenerateDocumentPickerData";
import { compileDocumentAction } from "@/modules/documentTemplates/compileDocumentAction";
import type { DocumentIssue } from "@/types/documentPlatform";

interface GenerateDocumentModalProps {
  open: boolean;
  onClose: () => void;
  templateId: string;
  onGenerated: (documentId: string) => void;
}

/**
 * Step 13's own "manual actions" path for generating a Document — a member
 * optionally picks a real Client/Event to merge from (never free-text id
 * entry) and compiles through the exact same `compileDocumentAction` the
 * Automation Engine's own "Generate X Document" Actions call.
 */
export function GenerateDocumentModal({ open, onClose, templateId, onGenerated }: GenerateDocumentModalProps) {
  const [picker, setPicker] = useState<GenerateDocumentPickerData | null>(null);
  const [clientId, setClientId] = useState("");
  const [eventId, setEventId] = useState("");
  const [issues, setIssues] = useState<DocumentIssue[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    getGenerateDocumentPickerData().then((result) => {
      setIssues([]);
      if (result.success) setPicker(result.data);
    });
  }, [open]);

  async function handleGenerate() {
    setGenerating(true);
    const result = await compileDocumentAction({ templateId, clientId: clientId || undefined, eventId: eventId || undefined });
    setGenerating(false);
    if (result.success) {
      onGenerated(result.document.id);
      onClose();
      return;
    }
    setIssues(result.issues);
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate Document">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text/70">Optionally pick a Client or Event to merge real data from.</p>
        <div>
          <label className="text-xs text-text/55" htmlFor="generate-document-client">
            Client
          </label>
          <Select id="generate-document-client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">None</option>
            {picker?.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-text/55" htmlFor="generate-document-event">
            Event
          </label>
          <Select id="generate-document-event" value={eventId} onChange={(event) => setEventId(event.target.value)}>
            <option value="">None</option>
            {picker?.events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.label}
              </option>
            ))}
          </Select>
        </div>
        {issues.length > 0 ? (
          <ul className="rounded-md border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
            {issues.map((issue) => (
              <li key={`${issue.code}-${issue.target}`}>{issue.message}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
