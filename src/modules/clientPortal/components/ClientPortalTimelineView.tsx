"use client";

import { useEffect, useState } from "react";
import { getClientPortalTimeline, logClientPortalActivityForCurrentSession } from "@/lib/data";
import type { ClientPortalTimelineEntry, ClientPortalTimelineEntryKind } from "@/types/clientPortalTimeline";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; entries: ClientPortalTimelineEntry[] };

const KIND_LABEL: Record<ClientPortalTimelineEntryKind, string> = {
  proposal_accepted: "Proposal Accepted",
  contract_generated: "Contract Generated",
  invoice_issued: "Invoice Issued",
  payment_received: "Payment Received",
  workflow_milestone: "Workflow Update",
  document_published: "Document Published",
};

const KIND_TONE: Record<ClientPortalTimelineEntryKind, BadgeTone> = {
  proposal_accepted: "accent",
  contract_generated: "neutral",
  invoice_issued: "warning",
  payment_received: "success",
  workflow_milestone: "outline",
  document_published: "neutral",
};

const ALL_KINDS = Object.keys(KIND_LABEL) as ClientPortalTimelineEntryKind[];

/**
 * Step 6's own client-facing Event Timeline — a read-only, aggregated feed
 * over real Proposal/Contract/Invoice/Payment/Document/Workflow-execution
 * history (`getClientPortalTimeline` in `lib/data/index.ts`), never a new
 * source of truth.
 *
 * Checkpoint 36, Step 8 — "Timeline Center": Search/Categories/Dates
 * filtering added client-side over the same already-fetched `entries`
 * array — the full history is small enough that a second, filtered server
 * round-trip would only add latency, not correctness.
 */
export function ClientPortalTimelineView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [activeKinds, setActiveKinds] = useState<Set<ClientPortalTimelineEntryKind>>(new Set(ALL_KINDS));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchTimeline = () =>
    getClientPortalTimeline()
      .then((entries) => setState({ status: "ready", entries }))
      .catch(() => setState({ status: "error" }));

  useEffect(() => {
    fetchTimeline();
    logClientPortalActivityForCurrentSession("timeline_viewed");

  }, []);

  function toggleKind(kind: ClientPortalTimelineEntryKind) {
    setActiveKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const entries = state.status === "ready" ? state.entries : [];
  const searchTerm = search.trim().toLowerCase();
  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
  const toMs = dateTo ? new Date(dateTo).getTime() : null;
  const filteredEntries = entries.filter((entry) => {
    if (!activeKinds.has(entry.kind)) return false;
    if (searchTerm.length > 0 && !`${entry.title} ${entry.description ?? ""}`.toLowerCase().includes(searchTerm)) return false;
    const occurredMs = new Date(entry.occurred_at).getTime();
    if (fromMs !== null && occurredMs < fromMs) return false;
    if (toMs !== null && occurredMs > toMs) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">Timeline</h1>
      <p className="text-sm text-text-muted">Everything that&rsquo;s happened on your account, in one place.</p>

      {state.status === "loading" ? (
        <div aria-live="polite" aria-busy="true">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your timeline." onRetry={fetchTimeline} />
      ) : entries.length === 0 ? (
        <EmptyState title="Nothing yet" description="Milestones for your event will appear here as they happen." />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="timeline-search" className="mb-1 block text-xs text-text-muted">
                  Search
                </label>
                <input
                  id="timeline-search"
                  type="text"
                  placeholder="Search timeline…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
                />
              </div>
              <div>
                <label htmlFor="timeline-from" className="mb-1 block text-xs text-text-muted">
                  From
                </label>
                <input id="timeline-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text" />
              </div>
              <div>
                <label htmlFor="timeline-to" className="mb-1 block text-xs text-text-muted">
                  To
                </label>
                <input id="timeline-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  aria-pressed={activeKinds.has(kind)}
                  className={`rounded-full border px-3 py-1 text-xs ${activeKinds.has(kind) ? "border-accent bg-accent/10 text-accent" : "border-border text-text-muted"}`}
                >
                  {KIND_LABEL[kind]}
                </button>
              ))}
            </div>
          </Card>

          {filteredEntries.length === 0 ? (
            <EmptyState title="No matching entries" description="Try adjusting your search, categories, or date range." />
          ) : (
            <ol className="space-y-3" aria-label="Event timeline">
              {filteredEntries.map((entry) => (
            <li key={entry.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={KIND_TONE[entry.kind]}>{KIND_LABEL[entry.kind]}</Badge>
                      <h3 className="truncate font-serif text-[15px] font-semibold text-text">{entry.title}</h3>
                    </div>
                    {entry.description ? <p className="mt-1 text-sm text-text-muted">{entry.description}</p> : null}
                  </div>
                  <time dateTime={entry.occurred_at} className="shrink-0 text-xs text-text-muted">
                    {new Date(entry.occurred_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </div>
              </Card>
            </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
