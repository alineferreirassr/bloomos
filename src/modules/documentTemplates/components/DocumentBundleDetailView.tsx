"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  getDocumentBundleDetailAction,
  removeDocumentBundleItemAction,
  updateDocumentBundleStatusAction,
  type DocumentBundleDetail,
} from "@/modules/documentTemplates/documentBundleActions";
import type { DocumentBundleStatus } from "@/types/documentPlatform";

interface DocumentBundleDetailViewProps {
  bundleId: string;
}

const STATUS_TONE: Record<DocumentBundleStatus, BadgeTone> = {
  draft: "neutral",
  ready: "outline",
  sent: "accent",
  viewed: "success",
};

const STATUS_LABEL: Record<DocumentBundleStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  sent: "Sent",
  viewed: "Viewed",
};

/** The forward-only status machine's own next legal step — `null` once a Bundle has been viewed (a terminal state this view never re-opens). */
const NEXT_STATUS: Record<DocumentBundleStatus, DocumentBundleStatus | null> = {
  draft: "ready",
  ready: "sent",
  sent: "viewed",
  viewed: null,
};

/**
 * v2 Checkpoint 44, Step 14 — Document Bundle Detail. Every field comes
 * from `getDocumentBundleDetailAction()`, itself a thin read of the real
 * `DocumentsManager` (Checkpoint 12) plus the Step 12 Health Engine —
 * this view adds no business logic, only presentation.
 */
export function DocumentBundleDetailView({ bundleId }: DocumentBundleDetailViewProps) {
  const [detail, setDetail] = useState<DocumentBundleDetail | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    getDocumentBundleDetailAction(bundleId)
      .then((result) => {
        if (result.success) {
          setDetail(result.data);
          setError(false);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleId]);

  async function handleAdvanceStatus() {
    if (!detail) return;
    const next = NEXT_STATUS[detail.bundle.status];
    if (!next) return;
    setBusy(true);
    await updateDocumentBundleStatusAction(bundleId, next);
    setBusy(false);
    load();
  }

  async function handleRemoveItem(itemId: string) {
    setBusy(true);
    await removeDocumentBundleItemAction(bundleId, itemId);
    setBusy(false);
    load();
  }

  if (error) {
    return <ErrorState message="Could not load this document bundle." onRetry={load} />;
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { bundle, resolvedItems, health } = detail;
  const next = NEXT_STATUS[bundle.status];

  return (
    <div className="space-y-6">
      <PageHeader
        title={bundle.title}
        subtitle={bundle.description || "Document Bundle"}
        actions={
          next ? (
            <Button onClick={handleAdvanceStatus} disabled={busy}>
              Mark {STATUS_LABEL[next]}
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-3">
        <Badge tone={STATUS_TONE[bundle.status]}>{STATUS_LABEL[bundle.status]}</Badge>
        <span className="text-sm text-text-muted">
          {resolvedItems.length} item{resolvedItems.length === 1 ? "" : "s"}
        </span>
      </div>

      <div>
        <SectionHeader title="Overview" />
        <div className="space-y-6">
          <LuxuryCard>
            <h2 className="font-serif text-[15px] font-semibold text-text">Bundle Health</h2>
            <div className="mt-3 space-y-3">
              <ProgressBar value={health.overallScore} label="Overall health" />
              <ul className="space-y-1.5">
                {health.categories.map((category) => (
                  <li key={category.category} className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">{category.category.replace(/_/g, " ")}</span>
                    <span className="text-text">{category.score === null ? "N/A" : `${category.score}%`}</span>
                  </li>
                ))}
              </ul>
              {health.categories.flatMap((c) => c.issues).length > 0 ? (
                <ul className="space-y-1 border-t border-border pt-2">
                  {health.categories.flatMap((c) => c.issues).map((issue, index) => (
                    <li key={index} className="text-xs text-warning">
                      {issue}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </LuxuryCard>

          <LuxuryCard>
            <h2 className="mb-3 font-serif text-[15px] font-semibold text-text">Items</h2>
            {resolvedItems.length === 0 ? (
              <p className="text-sm text-text-muted">No items in this bundle yet.</p>
            ) : (
              <ul className="space-y-2">
                {resolvedItems.map((resolved) => (
                  <li key={resolved.item.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text">{resolved.title}</p>
                      <p className="text-xs text-text-muted">
                        {resolved.item.kind.replace(/_/g, " ")}
                        {resolved.subtitle ? ` · ${resolved.subtitle}` : ""}
                        {!resolved.available ? " · No longer available" : ""}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => handleRemoveItem(resolved.item.id)} disabled={busy}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>
        </div>
      </div>
    </div>
  );
}
