"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDocumentOwnerSummary } from "@/lib/data";
import type { DocumentOwnerSummary } from "@/modules/documents/documentStats";
import type { EntityType } from "@/core/enums/entityType";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DocumentCategoryBadge } from "@/modules/documents/components/DocumentCategoryBadge";
import { formatBytes } from "@/modules/documents/mappers";
import { DOCUMENT_CATEGORIES } from "@/core/enums/documentCategory";

interface DocumentsSummarySectionProps {
  ownerType: EntityType;
  ownerId: string;
  /** Extra query params carried onto "Add Document Metadata" (e.g. clientId/eventId) so the reference is prefilled too. */
  newDocumentParams?: Record<string, string>;
}

/**
 * Small, reusable rollup embedded on Client/Event/Contract/Invoice/Payment/
 * Expense Detail — every figure comes straight from getDocumentOwnerSummary()
 * (lib/data/index.ts), never recomputed here. Mirrors
 * EventFinancialSummaryCard/ContractFinanceSummaryCard's "read-only rollup,
 * two quick-action links" shape.
 */
export function DocumentsSummarySection({ ownerType, ownerId, newDocumentParams = {} }: DocumentsSummarySectionProps) {
  const [summary, setSummary] = useState<DocumentOwnerSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDocumentOwnerSummary(ownerType, ownerId)
      .then((result) => {
        if (!cancelled) {
          setSummary(result);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerType, ownerId]);

  const viewParams = new URLSearchParams({ ownerType, ownerId }).toString();
  const newParams = new URLSearchParams({ ownerType, ownerId, ...newDocumentParams }).toString();

  if (error) {
    return (
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Documents</h3>
        <p className="mt-2 text-sm text-text-muted">Could not load the document summary.</p>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Documents</h3>
        <Skeleton className="mt-3 h-24 w-full" />
      </Card>
    );
  }

  const categoriesPresent = DOCUMENT_CATEGORIES.filter((category) => summary.byCategory[category] > 0);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[17px] font-semibold text-text">Documents</h3>
        <span className="text-xs text-text-muted">{formatBytes(summary.totalStorageBytes)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Total" value={String(summary.total)} />
        <Stat label="Active" value={String(summary.active)} />
        <Stat label="Draft" value={String(summary.draft)} />
        <Stat label="Expiring soon" value={String(summary.expiringSoon)} />
        <Stat label="Expired" value={String(summary.expired)} />
        <Stat label="Archived" value={String(summary.archived)} />
      </dl>

      {categoriesPresent.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {categoriesPresent.map((category) => (
            <DocumentCategoryBadge key={category} category={category} />
          ))}
        </div>
      ) : null}

      {summary.latestUploads.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {summary.latestUploads.map((document) => (
            <li key={document.id}>
              <Link
                href={`/documents/${document.id}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-accent/50"
              >
                <span className="truncate text-text">{document.title}</span>
                <span className="shrink-0 text-text-muted">
                  {document.size_bytes !== null ? formatBytes(document.size_bytes) : "No file"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-text-muted">No documents yet.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/documents/new?${newParams}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text hover:border-accent/50"
        >
          Add Document Metadata
        </Link>
        <Link
          href={`/documents?${viewParams}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text hover:border-accent/50"
        >
          View Documents
        </Link>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text">{value}</dd>
    </div>
  );
}
