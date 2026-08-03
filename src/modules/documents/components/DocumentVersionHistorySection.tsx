import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { DocumentVisibilityBadge } from "@/modules/documents/components/DocumentVisibilityBadge";
import { formatBytes, formatDocumentDate } from "@/modules/documents/mappers";
import type { Document } from "@/types/document";

/**
 * Built from getDocumentVersions() — a real chain of separate Document rows
 * (parent_document_id + version), unlike Contract's version_history
 * snapshot array. No diff visualization — just the list, newest first.
 */
export function DocumentVersionHistorySection({ versions }: { versions: Document[] }) {
  if (versions.length <= 1) {
    return (
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Version History</h3>
        <p className="mt-2 text-sm text-text-muted">This document has only one version.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Version History</h3>
      <ul className="mt-3 space-y-3" data-testid="document-version-history-list">
        {[...versions].reverse().map((version) => (
          <li key={version.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/documents/${version.id}`} className="text-sm font-medium text-text hover:text-accent">
                v{version.version} — {version.is_latest_version ? "Latest" : "Superseded"}
              </Link>
              <span className="text-xs text-text-muted">{new Date(version.uploaded_at).toLocaleDateString()}</span>
            </div>
            <p className="mt-0.5 text-xs text-text-muted">
              {version.file_name ?? "No file attached"}
              {version.size_bytes !== null ? ` · ${formatBytes(version.size_bytes)}` : ""}
              {version.expires_at ? ` · Expires ${formatDocumentDate(version.expires_at)}` : ""}
            </p>
            <div className="mt-1">
              <DocumentVisibilityBadge visibility={version.visibility} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
