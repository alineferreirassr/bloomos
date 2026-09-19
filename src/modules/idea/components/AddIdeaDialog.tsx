"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createIdeaItemAction, type IdeaItemActionInput } from "@/modules/idea/ideaActions";
import { IDEA_PRIORITY_LABELS } from "@/modules/idea/labels";
import { INSPIRATION_CONTENT_FORMAT_LABELS } from "@/modules/inspiration/labels";
import { INSPIRATION_CONTENT_FORMATS } from "@/types/inspirationItem";
import { IDEA_PRIORITIES } from "@/types/ideaItem";
import type { IdeaItem, IdeaPriority } from "@/types/ideaItem";
import type { InspirationContentFormat } from "@/types/inspirationItem";

interface AddIdeaDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (item: IdeaItem) => void;
}

/**
 * SOCIAL-07D's own MVP Add flow, mirroring `AddInspirationDialog.tsx`'s own
 * split exactly: only title/description/content_format/priority/hook/cta/
 * audience/notes — every one of them a plain scalar field with no picker or
 * cross-entity linkage. `source_inspiration_id` and `media_asset_id` are
 * deliberately absent (sent as null) — both require picker UI that this
 * checkpoint's own scope explicitly defers to SOCIAL-07E, matching
 * Inspiration's own D→E field split. Calls `createIdeaItemAction` only,
 * never a repository function directly.
 */
export function AddIdeaDialog({ open, onClose, onCreated }: AddIdeaDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentFormat, setContentFormat] = useState<InspirationContentFormat | "">("");
  const [priority, setPriority] = useState<IdeaPriority | "">("");
  const [hook, setHook] = useState("");
  const [cta, setCta] = useState("");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Same "adjust state during render on an open transition" pattern as
  // AddInspirationDialog.tsx — never a setState-in-effect.
  const [wasOpen, setWasOpen] = useState(!open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setDescription("");
      setContentFormat("");
      setPriority("");
      setHook("");
      setCta("");
      setAudience("");
      setNotes("");
      setError(null);
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const input: IdeaItemActionInput = {
        title: title.trim(),
        description: description.trim(),
        source_inspiration_id: null,
        content_format: contentFormat || null,
        hook: hook.trim() || null,
        cta: cta.trim() || null,
        audience: audience.trim() || null,
        notes: notes.trim() || null,
        media_asset_id: null,
        priority: priority || null,
      };
      const result = await createIdeaItemAction(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onCreated(result.data);
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Idea">
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="idea-title" className="mb-1.5 block text-xs font-medium text-text-muted">
            Title
          </label>
          <Input
            id="idea-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            invalid={!!error}
            placeholder="e.g. Behind-the-scenes wedding reel"
          />
        </div>

        <div>
          <label htmlFor="idea-description" className="mb-1.5 block text-xs font-medium text-text-muted">
            Description
          </label>
          <Textarea
            id="idea-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            invalid={!!error}
            placeholder="What's the concept for this piece of content?"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="idea-content-format" className="mb-1.5 block text-xs font-medium text-text-muted">
              Content Format (optional)
            </label>
            <Select
              id="idea-content-format"
              value={contentFormat}
              onChange={(e) => setContentFormat(e.target.value as InspirationContentFormat | "")}
              disabled={busy}
            >
              <option value="">Not specified</option>
              {INSPIRATION_CONTENT_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {INSPIRATION_CONTENT_FORMAT_LABELS[format]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="idea-priority" className="mb-1.5 block text-xs font-medium text-text-muted">
              Priority (optional)
            </label>
            <Select id="idea-priority" value={priority} onChange={(e) => setPriority(e.target.value as IdeaPriority | "")} disabled={busy}>
              <option value="">Not specified</option>
              {IDEA_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {IDEA_PRIORITY_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label htmlFor="idea-hook" className="mb-1.5 block text-xs font-medium text-text-muted">
            Hook (optional)
          </label>
          <Input id="idea-hook" value={hook} onChange={(e) => setHook(e.target.value)} disabled={busy} placeholder="What's the opening moment?" />
        </div>

        <div>
          <label htmlFor="idea-cta" className="mb-1.5 block text-xs font-medium text-text-muted">
            CTA (optional)
          </label>
          <Input id="idea-cta" value={cta} onChange={(e) => setCta(e.target.value)} disabled={busy} />
        </div>

        <div>
          <label htmlFor="idea-audience" className="mb-1.5 block text-xs font-medium text-text-muted">
            Audience (optional)
          </label>
          <Input id="idea-audience" value={audience} onChange={(e) => setAudience(e.target.value)} disabled={busy} />
        </div>

        <div>
          <label htmlFor="idea-notes" className="mb-1.5 block text-xs font-medium text-text-muted">
            Notes (optional)
          </label>
          <Textarea id="idea-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy} aria-busy={busy}>
            {busy ? "Saving…" : "Create Idea"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
