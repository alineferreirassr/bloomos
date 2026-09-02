"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { createDocumentBundleAction, listDocumentBundlesForClientAction } from "@/modules/documentTemplates/documentBundleActions";
import type { DocumentBundle, DocumentBundleStatus } from "@/types/documentPlatform";

interface DocumentBundlesSectionProps {
  clientId: string;
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

/**
 * v2 Checkpoint 44, Step 14 — Document Bundles' own Client Detail section,
 * mirroring `DocumentsSummarySection`'s own "self-fetching rollup, quick
 * actions" shape. Every field comes from `documentBundleActions.ts` — this
 * component adds no business logic of its own.
 */
export function DocumentBundlesSection({ clientId }: DocumentBundlesSectionProps) {
  const [bundles, setBundles] = useState<DocumentBundle[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = () => {
    listDocumentBundlesForClientAction(clientId)
      .then((result) => {
        if (result.success) {
          setBundles(result.data);
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
  }, [clientId]);

  async function handleCreate() {
    setCreating(true);
    const result = await createDocumentBundleAction({ clientId, eventId: null, title: "New Document Bundle", description: "" });
    setCreating(false);
    if (result.success) load();
  }

  if (error) {
    return (
      <LuxuryCard>
        <h3 className="font-serif text-[17px] font-semibold text-text">Document Bundles</h3>
        <p className="mt-2 text-sm text-text-muted">Could not load document bundles.</p>
      </LuxuryCard>
    );
  }

  if (!bundles) {
    return (
      <LuxuryCard>
        <h3 className="font-serif text-[17px] font-semibold text-text">Document Bundles</h3>
        <Skeleton className="mt-3 h-16 w-full" />
      </LuxuryCard>
    );
  }

  return (
    <LuxuryCard>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[17px] font-semibold text-text">Document Bundles</h3>
        <Button variant="secondary" onClick={handleCreate} disabled={creating}>
          {creating ? "Creating…" : "New Bundle"}
        </Button>
      </div>

      {bundles.length === 0 ? (
        <p className="mt-3 text-xs text-text-muted">No document bundles yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {bundles.map((bundle) => (
            <li key={bundle.id}>
              <Link
                href={`/documents/bundles/${bundle.id}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-accent/50"
              >
                <span className="truncate text-text">{bundle.title}</span>
                <span className="flex shrink-0 items-center gap-2 text-text-muted">
                  {bundle.items.length} item{bundle.items.length === 1 ? "" : "s"}
                  <Badge tone={STATUS_TONE[bundle.status]}>{STATUS_LABEL[bundle.status]}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </LuxuryCard>
  );
}
