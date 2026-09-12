"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDateOnly } from "@/lib/dateFormat";
import { archiveInspirationItemAction, unarchiveInspirationItemAction } from "@/modules/inspiration/inspirationActions";
import { INSPIRATION_SOURCE_TYPE_LABELS, INSPIRATION_CONTENT_FORMAT_LABELS } from "@/modules/inspiration/labels";
import { InspirationThumbnail } from "@/modules/inspiration/components/InspirationThumbnail";
import type { InspirationItem } from "@/types/inspirationItem";

interface InspirationDetailDialogProps {
  /** null closes the dialog (mirrors Modal's own `open` boolean, just keyed off the selected record instead of a separate flag). */
  item: InspirationItem | null;
  onClose: () => void;
  /** Whether the caller holds social.create — Edit/Archive/Unarchive are hidden, not merely disabled, for a read-only viewer. The Server Actions themselves are still the real enforcement boundary. */
  canManage: boolean;
  onChanged: (item: InspirationItem) => void;
  /** SOCIAL-06E — opens the richer Edit dialog for this item. Absent entirely for an archived item (Edit is blocked server-side until restored — see `ARCHIVED_EDIT_ERROR`), so this prop is optional rather than always rendering a control that would just fail on click. */
  onEdit?: (item: InspirationItem) => void;
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

/** Phase 19 — only ever render a validated http/https link; the migration/SOCIAL-06C server-side validation already guarantees this for a persisted row, but this stays defensive rather than trusting that implicitly. */
function isSafeExternalUrl(url: string | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formatCreatorLine(item: InspirationItem): string | null {
  const handle = item.creator_handle ? `@${item.creator_handle.replace(/^@/, "")}` : null;
  const parts = [item.creator_name, handle].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function InspirationDetailDialog({ item, onClose, canManage, onChanged, onEdit }: InspirationDetailDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  async function handleArchiveToggle() {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const result = item.archived_at ? await unarchiveInspirationItemAction(item.id) : await archiveInspirationItemAction(item.id);
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

  const creatorLine = formatCreatorLine(item);

  return (
    <Modal open={item !== null} onClose={onClose} title={item.title}>
      <div className="flex flex-col gap-3">
        {item.media_asset_id ? (
          <InspirationThumbnail mediaAssetId={item.media_asset_id} sourceType={item.source_type} title={item.title} className="mx-auto max-w-[220px]" />
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">{INSPIRATION_SOURCE_TYPE_LABELS[item.source_type]}</Badge>
          {item.content_format ? <Badge tone="neutral">{INSPIRATION_CONTENT_FORMAT_LABELS[item.content_format]}</Badge> : null}
          {item.archived_at ? <Badge tone="neutral">Archived</Badge> : null}
        </div>

        {isSafeExternalUrl(item.source_url) ? (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">
            Open source link
          </a>
        ) : null}

        {item.platform_content_id ? (
          <p className="text-xs text-text-muted">Content ID: {item.platform_content_id}</p>
        ) : null}

        {creatorLine ? <p className="text-sm text-text">{creatorLine}</p> : null}

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

        {item.why_it_works ? (
          <div>
            <p className="text-xs font-medium text-text-muted">Why it works</p>
            <p className="mt-0.5 text-sm text-text">{item.why_it_works}</p>
          </div>
        ) : null}

        {item.notes ? (
          <div>
            <p className="text-xs font-medium text-text-muted">Notes</p>
            <p className="mt-0.5 text-sm text-text">{item.notes}</p>
          </div>
        ) : null}

        <p className="text-xs text-text-muted">
          {item.duration_seconds !== null ? `${formatDuration(item.duration_seconds)} · ` : ""}
          {item.published_at ? `Published ${formatDateOnly(item.published_at)} · ` : ""}
          Saved {formatDateOnly(item.created_at)}
        </p>

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
