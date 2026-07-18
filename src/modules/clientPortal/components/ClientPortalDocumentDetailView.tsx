"use client";

import { useEffect, useState } from "react";
import { getClientPortalDocumentById, getClientPortalDocumentDownloadUrl } from "@/lib/data";
import type { ClientPortalDocument } from "@/types/clientPortal";
import { NotFoundError } from "@/core/errors";
import { formatBytes } from "@/modules/documents/mappers";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { DocumentCategoryBadge } from "@/modules/documents/components/DocumentCategoryBadge";
import { DocumentStatusBadge } from "@/modules/documents/components/DocumentStatusBadge";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; document: ClientPortalDocument; isExpired: boolean };

export function ClientPortalDocumentDetailView({ documentId }: { documentId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  /* isExpired is computed here, at fetch time, rather than inline in the
     component body — calling Date.now() during render would make the
     component non-idempotent, which the react-hooks/purity rule rejects. */
  const fetchDocument = () =>
    getClientPortalDocumentById(documentId)
      .then((document) => {
        const isExpired = document.expires_at !== null && new Date(document.expires_at).getTime() < Date.now();
        setState({ status: "ready", document, isExpired });
      })
      .catch((err) => setState({ status: err instanceof NotFoundError ? "not-found" : "error" }));

  useEffect(() => {
    fetchDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    const result = await getClientPortalDocumentDownloadUrl(documentId);
    setDownloading(false);
    if (!result.success) {
      setDownloadError(result.error);
      return;
    }
    // The UI only ever receives the signed URL itself — never a raw bucket/path.
    window.open(result.data, "_blank", "noopener,noreferrer");
  };

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "not-found") return <ErrorState message="This document could not be found." />;
  if (state.status === "error") return <ErrorState message="Could not load this document." onRetry={fetchDocument} />;

  const { document, isExpired } = state;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold text-text">{document.title}</h1>
        <DocumentCategoryBadge category={document.category} />
        <DocumentStatusBadge status={document.status} />
      </div>

      {document.description ? <p className="text-sm text-text-muted">{document.description}</p> : null}

      <Card>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="File" value={document.original_file_name} />
          <Field label="Size" value={document.hasFile ? formatBytes(document.size_bytes ?? 0) : "No file"} />
          <Field label="Uploaded" value={new Date(document.uploaded_at).toLocaleDateString()} />
          <Field label="Expires" value={document.expires_at ? new Date(document.expires_at).toLocaleDateString() : "Never"} />
        </dl>

        <div className="mt-4">
          {downloadError ? (
            <p role="alert" className="mb-2 text-xs text-rose-700 dark:text-rose-300">
              {downloadError}
            </p>
          ) : null}
          {!document.hasFile ? (
            <p className="text-xs text-text-muted">No file has been attached to this document yet.</p>
          ) : isExpired ? (
            <p className="text-xs text-text-muted">This document has expired and is no longer available for download.</p>
          ) : (
            <Button onClick={handleDownload} disabled={downloading}>
              {downloading ? "Preparing download…" : "Download"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || "—"}</dd>
    </div>
  );
}
