"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientPortalDocuments } from "@/lib/data";
import type { ClientPortalDocument } from "@/types/clientPortal";
import { formatBytes } from "@/modules/documents/mappers";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { DocumentCategoryBadge } from "@/modules/documents/components/DocumentCategoryBadge";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; documents: ClientPortalDocument[] };

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
        <div className="space-y-3">
          {state.documents.map((doc) => (
            <Link key={doc.id} href={`/client-access/documents/${doc.id}`}>
              <Card className="transition-colors hover:border-accent/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-[15px] font-semibold text-text">{doc.title}</h3>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {doc.hasFile ? formatBytes(doc.size_bytes ?? 0) : "No file"}
                      {doc.expires_at ? ` · Expires ${new Date(doc.expires_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <DocumentCategoryBadge category={doc.category} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
