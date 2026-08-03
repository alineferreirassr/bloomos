"use client";

import { useEffect, useState } from "react";
import {
  getClientPortalDocumentById,
  getClientPortalDocumentDownloadUrl,
  approveClientPortalDocument,
  rejectClientPortalDocument,
  logClientPortalActivityForCurrentSession,
} from "@/lib/data";
import { dispatchDocumentDownloadedTrigger } from "@/modules/clientPortal/dispatchClientPortalTriggerActions";
import type { ClientPortalDocument } from "@/types/clientPortal";
import { NotFoundError } from "@/core/errors";
import { formatBytes } from "@/modules/documents/mappers";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { DocumentCategoryBadge } from "@/modules/documents/components/DocumentCategoryBadge";
import { DocumentStatusBadge } from "@/modules/documents/components/DocumentStatusBadge";

const APPROVAL_TONE: Record<ClientPortalDocument["approvalStatus"], BadgeTone> = {
  pending: "outline",
  approved: "success",
  rejected: "danger",
};

const APPROVAL_LABEL: Record<ClientPortalDocument["approvalStatus"], string> = {
  pending: "Awaiting your review",
  approved: "Approved",
  rejected: "Rejected",
};

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; document: ClientPortalDocument; isExpired: boolean };

export function ClientPortalDocumentDetailView({ documentId }: { documentId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [decisionComment, setDecisionComment] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

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
    logClientPortalActivityForCurrentSession("document_viewed", documentId);
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
    logClientPortalActivityForCurrentSession("document_downloaded", documentId);
    dispatchDocumentDownloadedTrigger(documentId);
    // The UI only ever receives the signed URL itself — never a raw bucket/path.
    window.open(result.data, "_blank", "noopener,noreferrer");
  };

  const handleApprove = async () => {
    setDeciding(true);
    setDecisionError(null);
    const result = await approveClientPortalDocument(documentId, decisionComment.trim() || null);
    setDeciding(false);
    if (!result.success) {
      setDecisionError(result.error);
      return;
    }
    setState((current) => (current.status === "ready" ? { ...current, document: result.data } : current));
  };

  const handleReject = async () => {
    setDeciding(true);
    setDecisionError(null);
    const result = await rejectClientPortalDocument(documentId, decisionComment);
    setDeciding(false);
    if (!result.success) {
      setDecisionError(result.error);
      return;
    }
    setState((current) => (current.status === "ready" ? { ...current, document: result.data } : current));
  };

  if (state.status === "loading")
    return (
      <div aria-live="polite" aria-busy="true">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (state.status === "not-found") return <ErrorState message="This document could not be found." />;
  if (state.status === "error") return <ErrorState message="Could not load this document." onRetry={fetchDocument} />;

  const { document, isExpired } = state;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold text-text">{document.title}</h1>
        <DocumentCategoryBadge category={document.category} />
        <DocumentStatusBadge status={document.status} />
        <Badge tone="neutral">v{document.version}{document.is_latest_version ? " (latest)" : ""}</Badge>
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
            <p role="alert" className="mb-2 text-xs text-danger">
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

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-[15px] font-semibold text-text">Your Review</h2>
          <span aria-live="polite">
            <Badge tone={APPROVAL_TONE[document.approvalStatus]}>{APPROVAL_LABEL[document.approvalStatus]}</Badge>
          </span>
        </div>
        <p className="mt-1 text-xs text-text-muted">Approving or rejecting records your own decision — it never edits this document.</p>
        {document.approvalComment ? (
          <p className="mt-2 text-sm text-text">
            <span className="font-medium text-text-muted">Your comment: </span>
            {document.approvalComment}
          </p>
        ) : null}

        <div className="mt-3 space-y-2">
          <label htmlFor="decision-comment" className="sr-only">
            Comment (optional — required if you reject)
          </label>
          <input
            id="decision-comment"
            type="text"
            placeholder="Add an optional comment… (required to reject)"
            value={decisionComment}
            onChange={(event) => setDecisionComment(event.target.value)}
            aria-invalid={decisionError ? true : undefined}
            aria-describedby={decisionError ? "decision-comment-error" : undefined}
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
          />
          {decisionError ? (
            <p id="decision-comment-error" role="alert" className="text-xs text-danger">
              {decisionError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleApprove} disabled={deciding || document.approvalStatus === "approved"}>
              {deciding ? "Saving…" : "Approve"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleReject} disabled={deciding || document.approvalStatus === "rejected"}>
              {deciding ? "Saving…" : "Reject"}
            </Button>
          </div>
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
