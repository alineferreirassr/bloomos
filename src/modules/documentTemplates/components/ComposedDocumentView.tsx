"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Toast } from "@/components/ui/Toast";
import { getComposedDocumentViewData, type ComposedDocumentViewData } from "@/modules/documentTemplates/getComposedDocumentViewData";
import {
  publishDocumentVersionAction,
  archiveDocumentAction,
  unarchiveDocumentAction,
  restoreDocumentVersionAction,
  duplicateDocumentAction,
} from "@/modules/documentTemplates/documentLifecycleActions";
import { BlockPreview } from "@/modules/documentTemplates/components/BlockPreview";
import { blocksToPlainText } from "@/core/documents/exportPlainText";
import { logDocumentDownloadAction } from "@/modules/documentTemplates/logDocumentDownloadAction";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: ComposedDocumentViewData };

async function load(documentId: string): Promise<LoadState> {
  const result = await getComposedDocumentViewData(documentId);
  if (!result.success) return { status: "error", message: result.error };
  return { status: "ready", data: result.data };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** The compiled Document's own viewer — rendered Preview via `BlockPreview`, its full immutable Version History (Step 6), and Publish/Archive/Duplicate/Restore actions. */
export function ComposedDocumentView({ documentId }: { documentId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load(documentId).then(setState);
  }, [documentId]);

  function refresh() {
    load(documentId).then(setState);
  }

  async function handlePublishVersion() {
    setBusy(true);
    const result = await publishDocumentVersionAction(documentId, null);
    setBusy(false);
    if (!result.success) setToast(result.error);
    else refresh();
  }

  async function handleArchiveToggle(archived: boolean) {
    setBusy(true);
    const result = archived ? await unarchiveDocumentAction(documentId) : await archiveDocumentAction(documentId);
    setBusy(false);
    if (!result.success) setToast(result.error);
    else refresh();
  }

  async function handleRestore(version: number) {
    setBusy(true);
    const result = await restoreDocumentVersionAction(documentId, version);
    setBusy(false);
    if (!result.success) setToast(result.error);
    else refresh();
  }

  async function handleDuplicate() {
    setBusy(true);
    const result = await duplicateDocumentAction(documentId);
    setBusy(false);
    if (!result.success) setToast(result.error);
  }

  async function handleDownload() {
    if (state.status !== "ready") return;
    await logDocumentDownloadAction(documentId);
    const text = blocksToPlainText(state.data.document.content);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${state.data.document.metadata.title || "document"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={refresh} />;
  }

  const { document, template, documentType, versions, canPublish } = state.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-text text-balance">{document.metadata.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={document.status === "published" ? "success" : document.status === "archived" ? "neutral" : "outline"}>{document.status}</Badge>
        </div>
        <p className="mt-3 text-sm text-text-muted">
          {documentType?.label ?? document.documentTypeId}
          {template ? (
            <>
              {" · from "}
              <Link href={`/document-templates/${template.id}`} className="text-accent hover:underline">
                {template.name}
              </Link>
            </>
          ) : null}
        </p>
        {canPublish ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Button type="button" variant="secondary" onClick={handleDownload}>
              Download
            </Button>
            <Button type="button" onClick={handlePublishVersion} disabled={busy}>
              Publish New Version
            </Button>
            <Button type="button" variant="secondary" onClick={handleDuplicate} disabled={busy}>
              Duplicate
            </Button>
            <Button type="button" variant="ghost" onClick={() => handleArchiveToggle(document.status === "archived")} disabled={busy}>
              {document.status === "archived" ? "Unarchive" : "Archive"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <SectionHeader title="Overview" />
          <LuxuryCard tone="tint">
            <BlockPreview blocks={document.content} />
          </LuxuryCard>
        </div>

        <div className="lg:w-80 shrink-0">
          <SectionHeader title="Versions" />
          <LuxuryCard>
            {versions.length === 0 ? (
              <p className="text-sm text-text/55">No published versions yet — this Document is still a draft.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {versions.map((version) => (
                  <li key={version.id} className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 text-sm last:border-b-0 last:pb-0">
                    <div>
                      <p className="font-medium text-text">Version {version.version}</p>
                      <p className="text-xs text-text/55">{formatDateTime(version.compiledAt)}</p>
                      {version.label ? <p className="text-xs text-text/55">{version.label}</p> : null}
                    </div>
                    {canPublish ? (
                      <Button type="button" variant="ghost" onClick={() => handleRestore(version.version)} disabled={busy}>
                        Restore
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>
        </div>
      </div>

      {toast ? <Toast tone="danger" message={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
