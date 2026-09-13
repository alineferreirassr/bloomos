"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDateOnly } from "@/lib/dateFormat";
import { archiveIdeaItemAction, unarchiveIdeaItemAction } from "@/modules/idea/ideaActions";
import { getInspirationItemAction } from "@/modules/inspiration/inspirationActions";
import { IDEA_PRIORITY_LABELS } from "@/modules/idea/labels";
import { INSPIRATION_CONTENT_FORMAT_LABELS } from "@/modules/inspiration/labels";
import { IdeaMediaAssetPreview } from "@/modules/idea/components/IdeaMediaAssetPreview";
import type { IdeaItem } from "@/types/ideaItem";

interface IdeaDetailDialogProps {
  /** null closes the dialog — mirrors `InspirationDetailDialog`'s own convention of keying off the selected record instead of a separate open flag. */
  item: IdeaItem | null;
  onClose: () => void;
  /** Whether the caller holds social.create — Edit/Archive/Restore are hidden, not merely disabled, for a read-only viewer. The Server Actions themselves are still the real enforcement boundary. */
  canManage: boolean;
  onChanged: (item: IdeaItem) => void;
  /** SOCIAL-07E — opens the richer Edit dialog for this item. Absent entirely for an archived item (Edit is blocked server-side until restored — see `ARCHIVED_EDIT_ERROR` in `ideaActions.ts`), so this prop is optional rather than always rendering a control that would just fail on click. Mirrors `InspirationDetailDialog`'s own `onEdit` prop exactly. */
  onEdit?: (item: IdeaItem) => void;
}

/**
 * SOCIAL-07E — extends the SOCIAL-07D read-only detail view with an Edit
 * entry point plus linked-Inspiration and MediaAsset display, mirroring
 * `InspirationDetailDialog.tsx`'s own SOCIAL-06E shape exactly. Resolving
 * the linked Inspiration's title is display-only — it is never used to
 * pre-fill or copy any field.
 */
export function IdeaDetailDialog({ item, onClose, canManage, onChanged, onEdit }: IdeaDetailDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedInspirationTitle, setLinkedInspirationTitle] = useState<{ forId: string; title: string | null } | null>(null);

  const sourceInspirationId = item?.source_inspiration_id ?? null;

  useEffect(() => {
    if (!sourceInspirationId) return;
    let cancelled = false;
    getInspirationItemAction(sourceInspirationId).then((result) => {
      if (cancelled) return;
      setLinkedInspirationTitle({ forId: sourceInspirationId, title: result.success ? result.data.title : null });
    });
    return () => {
      cancelled = true;
    };
  }, [sourceInspirationId]);

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

  const resolvedLinkedTitle = sourceInspirationId && linkedInspirationTitle?.forId === sourceInspirationId ? linkedInspirationTitle.title : null;

  return (
    <Modal open={item !== null} onClose={onClose} title={item.title}>
      <div className="flex flex-col gap-3">
        {item.media_asset_id ? <IdeaMediaAssetPreview mediaAssetId={item.media_asset_id} title={item.title} className="mx-auto max-w-[220px]" /> : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {item.priority ? <Badge tone="accent">{IDEA_PRIORITY_LABELS[item.priority]}</Badge> : null}
          {item.content_format ? <Badge tone="neutral">{INSPIRATION_CONTENT_FORMAT_LABELS[item.content_format]}</Badge> : null}
          {item.archived_at ? <Badge tone="neutral">Archived</Badge> : null}
        </div>

        <div>
          <p className="text-xs font-medium text-text-muted">Description</p>
          <p className="mt-0.5 text-sm text-text">{item.description}</p>
        </div>

        {sourceInspirationId ? (
          <p className="text-xs text-text-muted">Inspired by: {resolvedLinkedTitle ?? "Loading…"}</p>
        ) : null}

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
          {canManage && !item.archived_at && onEdit ? (
            <Button variant="secondary" onClick={() => onEdit(item)} disabled={busy}>
              Edit
            </Button>
          ) : null}
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
