"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createInspirationItemAction, type InspirationItemActionInput } from "@/modules/inspiration/inspirationActions";
import { suggestSourceTypeFromUrl } from "@/lib/inspiration/suggestSourceType";
import { INSPIRATION_SOURCE_TYPE_LABELS, INSPIRATION_CONTENT_FORMAT_LABELS } from "@/modules/inspiration/labels";
import { INSPIRATION_SOURCE_TYPES, INSPIRATION_CONTENT_FORMATS } from "@/types/inspirationItem";
import type { InspirationItem, InspirationSourceType, InspirationContentFormat } from "@/types/inspirationItem";

interface AddInspirationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (item: InspirationItem) => void;
}

const DEFAULT_SOURCE_TYPE: InspirationSourceType = "manual";

/**
 * SOCIAL-06D's own MVP Add flow (Phase 14) — only title/source_type/
 * source_url/creator_name/creator_handle/content_format/hook/notes.
 * cta/why_it_works/duration_seconds/published_at/media_asset_id are
 * deliberately absent (sent as null) — SOCIAL-06E owns the richer editor.
 * Calls `createInspirationItemAction` only, never a repository function
 * directly.
 */
export function AddInspirationDialog({ open, onClose, onCreated }: AddInspirationDialogProps) {
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<InspirationSourceType>(DEFAULT_SOURCE_TYPE);
  const [sourceTypeTouched, setSourceTypeTouched] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorHandle, setCreatorHandle] = useState("");
  const [contentFormat, setContentFormat] = useState<InspirationContentFormat | "">("");
  const [hook, setHook] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Same "adjust state during render on an open transition" pattern as
  // SocialScheduleDialog.tsx — never a setState-in-effect.
  const [wasOpen, setWasOpen] = useState(!open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setSourceType(DEFAULT_SOURCE_TYPE);
      setSourceTypeTouched(false);
      setSourceUrl("");
      setCreatorName("");
      setCreatorHandle("");
      setContentFormat("");
      setHook("");
      setNotes("");
      setError(null);
      setBusy(false);
    }
  }

  /**
   * Phase 15's "optional safe convenience" — pure hostname string matching,
   * never fetched/scraped. Only auto-applies while the founder hasn't
   * manually chosen a Source Type themselves, so it never clobbers a
   * deliberate manual selection (Phase 30's own explicit test).
   */
  function handleSourceUrlChange(value: string) {
    setSourceUrl(value);
    if (!sourceTypeTouched) {
      const suggested = suggestSourceTypeFromUrl(value);
      if (suggested) setSourceType(suggested);
    }
  }

  function handleSourceTypeChange(value: InspirationSourceType) {
    setSourceTypeTouched(true);
    setSourceType(value);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const input: InspirationItemActionInput = {
        title: title.trim(),
        source_type: sourceType,
        source_url: sourceUrl.trim() || null,
        creator_name: creatorName.trim() || null,
        creator_handle: creatorHandle.trim() || null,
        platform_content_id: null,
        content_format: contentFormat || null,
        hook: hook.trim() || null,
        cta: null,
        why_it_works: null,
        notes: notes.trim() || null,
        duration_seconds: null,
        published_at: null,
        media_asset_id: null,
      };
      const result = await createInspirationItemAction(input);
      if (!result.success) {
        // Controlled, friendly error (including a duplicate-link message) —
        // the dialog stays open with everything still filled in so the
        // founder can adjust the URL/content and retry (Phase 18).
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
    <Modal open={open} onClose={onClose} title="Add Inspiration">
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="inspiration-title" className="mb-1.5 block text-xs font-medium text-text-muted">
            Title
          </label>
          <Input
            id="inspiration-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            invalid={!!error}
            placeholder="e.g. Behind-the-scenes reel idea"
          />
        </div>

        <div>
          <label htmlFor="inspiration-source-type" className="mb-1.5 block text-xs font-medium text-text-muted">
            Source Type
          </label>
          <Select
            id="inspiration-source-type"
            value={sourceType}
            onChange={(e) => handleSourceTypeChange(e.target.value as InspirationSourceType)}
            disabled={busy}
          >
            {INSPIRATION_SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {INSPIRATION_SOURCE_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="inspiration-source-url" className="mb-1.5 block text-xs font-medium text-text-muted">
            Source URL (optional)
          </label>
          <Input
            id="inspiration-source-url"
            type="url"
            value={sourceUrl}
            onChange={(e) => handleSourceUrlChange(e.target.value)}
            disabled={busy}
            placeholder="https://…"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="inspiration-creator-name" className="mb-1.5 block text-xs font-medium text-text-muted">
              Creator Name (optional)
            </label>
            <Input id="inspiration-creator-name" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} disabled={busy} />
          </div>
          <div>
            <label htmlFor="inspiration-creator-handle" className="mb-1.5 block text-xs font-medium text-text-muted">
              Creator Handle (optional)
            </label>
            <Input id="inspiration-creator-handle" value={creatorHandle} onChange={(e) => setCreatorHandle(e.target.value)} disabled={busy} />
          </div>
        </div>

        <div>
          <label htmlFor="inspiration-content-format" className="mb-1.5 block text-xs font-medium text-text-muted">
            Content Format (optional)
          </label>
          <Select
            id="inspiration-content-format"
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
          <label htmlFor="inspiration-hook" className="mb-1.5 block text-xs font-medium text-text-muted">
            Hook (optional)
          </label>
          <Input id="inspiration-hook" value={hook} onChange={(e) => setHook(e.target.value)} disabled={busy} placeholder="What makes the opening moment work?" />
        </div>

        <div>
          <label htmlFor="inspiration-notes" className="mb-1.5 block text-xs font-medium text-text-muted">
            Notes (optional)
          </label>
          <Textarea id="inspiration-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy} aria-busy={busy}>
            {busy ? "Saving…" : "Add Inspiration"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
