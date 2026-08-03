"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientPortalDocuments } from "@/lib/data";
import type { ClientPortalDocument } from "@/types/clientPortal";
import { DOCUMENT_CATEGORY_LABELS } from "@/core/enums/documentCategory";
import { formatBytes } from "@/modules/documents/mappers";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { DocumentCategoryBadge } from "@/modules/documents/components/DocumentCategoryBadge";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; documents: ClientPortalDocument[] };

function DocumentRow({ doc }: { doc: ClientPortalDocument }) {
  return (
    <Link href={`/client-access/documents/${doc.id}`}>
      <Card className="transition-colors hover:border-accent/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-serif text-[15px] font-semibold text-text">{doc.title}</h3>
            <p className="mt-0.5 text-xs text-text-muted">
              {doc.hasFile ? formatBytes(doc.size_bytes ?? 0) : "No file"}
              {doc.version > 1 ? ` · v${doc.version}` : ""}
              {doc.expires_at ? ` · Expires ${new Date(doc.expires_at).toLocaleDateString()}` : ""}
            </p>
          </div>
          <DocumentCategoryBadge category={doc.category} />
        </div>
      </Card>
    </Link>
  );
}

/** Checkpoint 36, Step 6 — the Document Center's own "Recent Documents" surface, the same "soonest/latest first, distinct from the full list" pattern `ClientPortalInvoicesListView.tsx`'s own Upcoming Payments section established. */
function RecentDocumentsSection({ documents }: { documents: ClientPortalDocument[] }) {
  const recent = documents
    .slice()
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
    .slice(0, 5);

  if (recent.length === 0) return null;

  return (
    <section aria-labelledby="recent-documents-heading">
      <h2 id="recent-documents-heading" className="mb-2 font-serif text-lg font-semibold text-text">
        Recent Documents
      </h2>
      <div className="space-y-2">
        {recent.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}
      </div>
    </section>
  );
}

/** Checkpoint 36, Step 6 — "Folders": every document already carries a real `category` (Checkpoint 25's own Document domain), so grouping by it is the honest reuse seam rather than inventing a new folder hierarchy/storage concept. */
function FoldersSection({ documents }: { documents: ClientPortalDocument[] }) {
  const byCategory = new Map<ClientPortalDocument["category"], ClientPortalDocument[]>();
  for (const doc of documents) {
    const group = byCategory.get(doc.category) ?? [];
    group.push(doc);
    byCategory.set(doc.category, group);
  }
  const categories = Array.from(byCategory.keys()).sort((a, b) => DOCUMENT_CATEGORY_LABELS[a].localeCompare(DOCUMENT_CATEGORY_LABELS[b]));

  return (
    <section aria-labelledby="folders-heading" className="space-y-5">
      <h2 id="folders-heading" className="font-serif text-lg font-semibold text-text">
        Folders
      </h2>
      {categories.map((category) => (
        <div key={category}>
          <h3 className="mb-2 text-sm font-medium text-text-muted">
            {DOCUMENT_CATEGORY_LABELS[category]} ({byCategory.get(category)?.length})
          </h3>
          <div className="space-y-2">
            {byCategory.get(category)?.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function ClientPortalDocumentsListView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchDocuments = () =>
    getClientPortalDocuments()
      .then((documents) => setState({ status: "ready", documents }))
      .catch(() => setState({ status: "error" }));

  useEffect(() => {
    fetchDocuments();
     
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">My Documents</h1>

      {state.status === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your documents." onRetry={fetchDocuments} />
      ) : state.documents.length === 0 ? (
        <EmptyState title="No documents yet" description="Documents shared with you will appear here." />
      ) : (
        <div className="space-y-8">
          <RecentDocumentsSection documents={state.documents} />
          <FoldersSection documents={state.documents} />
        </div>
      )}
    </div>
  );
}
