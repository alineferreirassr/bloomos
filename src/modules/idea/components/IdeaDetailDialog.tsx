"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDateOnly } from "@/lib/dateFormat";
import { archiveIdeaItemAction, unarchiveIdeaItemAction } from "@/modules/idea/ideaActions";
import { IDEA_PRIORITY_LABELS } from "@/modules/idea/labels";
import { INSPIRATION_CONTENT_FORMAT_LABELS } from "@/modules/inspiration/labels";
import type { IdeaItem } from "@/types/ideaItem";

interface IdeaDetailDialogProps {
  /** null closes the dialog — mirrors `InspirationDetailDialog`'s own convention of keying off the selected record instead of a separate open flag. */
  item: IdeaItem | null;
  onClose: () => void;
  /** Whether the caller holds social.create — Archive/Restore is hidden, not merely disabled, for a read-only viewer. The Server Actions themselves are still the real enforcement boundary. */
  canManage: boolean;
  onChanged: (item: IdeaItem) => void;
}

/**
 * SOCIAL-07D — read-only detail view + Archive/Restore, mirroring
 * `InspirationDetailDialog.tsx`'s own SOCIAL-06D-era shape exactly: no Edit
 * button, no MediaAsset preview, no Inspiration-link display. Editing an
 * existing Idea, attaching a MediaAsset, and showing/changing a
 * `source_inspiration_id` are all SOCIAL-07E scope — this checkpoint only
 * ever reads an Idea and toggles its archive state.
 */
export function IdeaDetailDialog({ item, onClose, canManage, onChanged }: IdeaDetailDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  async function handleArchiveToggle() {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const result = item.archived_at ? await unarchiveIdeaItemAction(item.id) : await archiveIdeaItemAction(item.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onChanged(result.data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={item !== null} onClose={onClose} title={item.title}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.priority ? <Badge tone="accent">{IDEA_PRIORITY_LABELS[item.priority]}</Badge> : null}
          {item.content_format ? <Badge tone="neutral">{INSPIRATION_CONTENT_FORMAT_LABELS[item.content_format]}</Badge> : null}
          {item.archived_at ? <Badge tone="neutral">Archived</Badge> : null}
        </div>

        <div>
          <p className="text-xs font-medium text-text-muted">Description</p>
          <p className="mt-0.5 text-sm text-text">{item.description}</p>
        </div>

        {item.hook ? (
          <div>
            <p className="text-xs font-medium text-text-muted">Hook</p>
            <p className="mt-0.5 text-sm text-text">{item.hook}</p>
          </div>
        ) : null}

        {item.cta ? (
          <div>
            <p className="text-xs font-medium text-text-muted">CTA</p>
            <p className="mt-0.5 text-sm text-text">{item.cta}</p>
          </div>
        ) : null}

        {item.audience ? (
          <div>
            <p className="text-xs font-medium text-text-muted">Audience</p>
            <p className="mt-0.5 text-sm text-text">{item.audience}</p>
          </div>
        ) : null}

        {item.notes ? (
          <div>
            <p className="text-xs font-medium text-text-muted">Notes</p>
            <p className="mt-0.5 text-sm text-text">{item.notes}</p>
          </div>
        ) : null}

        <p className="text-xs text-text-muted">Created {formatDateOnly(item.created_at)}</p>

        {error ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {canManage ? (
            <Button onClick={handleArchiveToggle} disabled={busy} aria-busy={busy}>
              {busy ? "Saving…" : item.archived_at ? "Restore" : "Archive"}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
