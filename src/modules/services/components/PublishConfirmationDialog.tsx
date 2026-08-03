"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { VersionBadge } from "@/modules/services/components/VersionBadge";
import { usePublishPreview } from "@/modules/services/hooks/usePublishPreview";
import { classifyThrownError } from "@/modules/services/hooks/errorContract";
import { ALL_TEMPLATE_CATEGORY_ADAPTERS } from "@/modules/services/templateCategoryAdapters";
import type { PublishServiceVersionInput } from "@/modules/services/schema";

interface PublishConfirmationDialogProps {
  serviceId: string;
  serviceName: string;
  /** The live draft's `updated_at`, straight from `useServiceEditor` (always current) — compared against the preview's own frozen snapshot to detect "the draft changed since this preview was fetched." */
  liveDraftVersionUpdatedAt: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (input: PublishServiceVersionInput) => Promise<unknown>;
  /** Fired after a successful publish, with the version number that was just published — the dialog is the one place that number is known without a second query. */
  onPublished: (versionNumber: number) => void;
}

function categoryLabel(key: string): string {
  return ALL_TEMPLATE_CATEGORY_ADAPTERS.find((adapter) => adapter.key === key)?.label ?? key;
}

/**
 * The single Publish confirmation surface — the only place a Service is
 * ever published from (ServiceDetailHeader's "Publish" button opens this
 * and nothing else does). Renders `usePublishPreview` exactly as returned;
 * every distinction it draws (blocking vs. warning, stale vs. current) is
 * already decided by the query layer, never recomputed here.
 */
export function PublishConfirmationDialog({
  serviceId,
  serviceName,
  liveDraftVersionUpdatedAt,
  open,
  onClose,
  onConfirm,
  onPublished,
}: PublishConfirmationDialogProps) {
  const [changeSummary, setChangeSummary] = useState("");
  const [error, setError] = useState<ReturnType<typeof classifyThrownError> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const preview = usePublishPreview(serviceId, { enabled: open });

  const isStale = preview.status === "success" && preview.data.draftVersionUpdatedAt !== liveDraftVersionUpdatedAt;

  function handleClose() {
    setChangeSummary("");
    setError(null);
    onClose();
  }

  function handleRefreshPreview() {
    setError(null);
    preview.refetch();
  }

  async function handleConfirm() {
    if (preview.status !== "success") return;
    const versionNumber = preview.data.nextVersionNumber;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({ change_summary: changeSummary.trim() || null });
      handleClose();
      onPublished(versionNumber);
    } catch (thrown) {
      setError(classifyThrownError(thrown));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Publish "${serviceName}"`}>
      {preview.status === "pending" ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : preview.status === "error" ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-danger">
            We couldn&apos;t load the publish preview.
          </p>
          <Button type="button" variant="secondary" onClick={() => preview.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <VersionBadge status="draft" versionNumber={null} />
            <span className="text-text-muted">→</span>
            <Badge tone="accent">Published v{preview.data.nextVersionNumber}</Badge>
          </div>
          <p className="text-xs text-text-muted">
            {preview.data.currentPublishedVersionNumber != null
              ? `Replaces the current Published v${preview.data.currentPublishedVersionNumber}, which stays visible in Version History.`
              : "This is the first published version of this Service."}
          </p>

          {isStale ? (
            <div role="alert" className="space-y-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              <p>This draft changed since you opened this preview. Refresh to see the latest information before publishing.</p>
              <Button type="button" variant="secondary" onClick={handleRefreshPreview}>
                Refresh preview
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <ProgressBar value={preview.data.health.percent} label="Health score" />
            <ProgressBar value={preview.data.templateCompletion.percent} label="Template completion" />
          </div>

          {preview.data.blockingErrors.length > 0 ? (
            <div role="alert" className="space-y-1 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {preview.data.blockingErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}

          {preview.data.warnings.length > 0 ? (
            <div className="space-y-1 rounded-md border border-border bg-text/5 px-3 py-2 text-sm text-text-muted">
              <p className="font-semibold text-text">Warnings — publishing is still allowed</p>
              {preview.data.warnings.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}

          {preview.data.affectedCategories.length > 0 ? (
            <p className="text-xs text-text-muted">Includes: {preview.data.affectedCategories.map(categoryLabel).join(", ")}.</p>
          ) : null}

          <FormField label="What changed" htmlFor="publish_change_summary" hint="Optional — shown in Version History later.">
            <Textarea
              id="publish_change_summary"
              rows={3}
              value={changeSummary}
              onChange={(event) => setChangeSummary(event.target.value)}
              disabled={!preview.data.canPublish || isStale}
            />
          </FormField>

          {error ? (
            <div role="alert" className="space-y-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              <p>{error.kind === "conflict" ? `${error.message} Refresh the preview to see what changed.` : error.message}</p>
              {error.kind === "conflict" ? (
                <Button type="button" variant="secondary" onClick={handleRefreshPreview}>
                  Refresh preview
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="button" onClick={handleConfirm} disabled={!preview.data.canPublish || isStale || submitting}>
              {submitting ? "Publishing…" : "Publish"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
