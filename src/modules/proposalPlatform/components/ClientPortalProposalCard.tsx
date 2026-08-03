"use client";

import { useEffect, useState } from "react";
import {
  listClientPortalProposalsAction,
  getClientPortalProposalAction,
  requestProposalRevisionAction,
  submitClientProposalResponseAction,
  toggleFavoriteProposalAction,
  type ClientPortalProposalSummary,
} from "@/modules/clientPortal/getClientPortalProposal";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * v2.0 Checkpoint 33, Step 14 — Client Proposal Experience. Self-fetching,
 * additive card slotted into the existing approved Client Dashboard
 * structure, mirroring `ClientPortalJourneyCard`'s own precedent
 * (Checkpoint 32) exactly. Only ever renders proposals that have actually
 * been sent — a draft still being built is never visible to the client.
 * "Accept"/"Decline" record the client's own recorded INTENT only (see
 * `getClientPortalProposal.ts`'s doc comment) — never the real, staff-only
 * `ProposalDraft.status` transition. "Download PDF" is the spec's own
 * named placeholder: shown, disabled, with no server action behind it —
 * no PDF generation exists this checkpoint.
 */

interface ProposalListItem {
  proposalId: string;
  title: string;
  grandTotal_minor: number | null;
  currency: string | null;
  sentAt: string | null;
}

function formatMoney(minor: number | null, currency: string | null): string {
  if (minor === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(minor / 100);
}

export function ClientPortalProposalCard() {
  const [proposals, setProposals] = useState<ProposalListItem[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientPortalProposalSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listClientPortalProposalsAction().then((result) => {
      if (cancelled) return;
      if (result.success) setProposals(result.data);
      else setError(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleExpand(proposalId: string) {
    if (expandedId === proposalId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(proposalId);
    const result = await getClientPortalProposalAction(proposalId);
    if (result.success) setDetail(result.data);
  }

  async function handleFavorite(proposalId: string, favorited: boolean) {
    await toggleFavoriteProposalAction(proposalId, !favorited);
    const result = await getClientPortalProposalAction(proposalId);
    if (result.success) setDetail(result.data);
  }

  async function handleResponse(proposalId: string, response: "accepted" | "declined") {
    await submitClientProposalResponseAction(proposalId, response);
    const result = await getClientPortalProposalAction(proposalId);
    if (result.success) setDetail(result.data);
  }

  async function handleRequestRevision(proposalId: string) {
    const note = window.prompt("What would you like changed?");
    if (!note) return;
    await requestProposalRevisionAction(proposalId, note);
  }

  if (error) return null;

  return (
    <LuxuryCard>
      <SectionHeader title="Your Proposals" />
      {!proposals ? (
        <p className="text-luxury-small text-luxury-text-muted">Loading…</p>
      ) : proposals.length === 0 ? (
        <EmptyState title="No proposals yet" description="Proposals sent to you will appear here." />
      ) : (
        <ul role="list" className="space-y-3">
          {proposals.map((p) => (
            <li key={p.proposalId} role="listitem" className="rounded-lg border border-luxury-border/50 p-3">
              <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => toggleExpand(p.proposalId)}>
                <span className="text-luxury-body font-medium text-luxury-text">{p.title}</span>
                <span className="text-luxury-small text-luxury-text-muted">{formatMoney(p.grandTotal_minor, p.currency)}</span>
              </button>

              {expandedId === p.proposalId && detail && (
                <div className="mt-3 space-y-3 border-t border-luxury-border/50 pt-3">
                  {detail.pricing && (
                    <p className="text-luxury-small text-luxury-text-muted">
                      Deposit due: {formatMoney(detail.pricing.depositDue_minor, detail.pricing.currency)} · Balance: {formatMoney(detail.pricing.remainingBalance_minor, detail.pricing.currency)}
                    </p>
                  )}
                  {detail.clientResponse && <p className="text-luxury-small text-luxury-rose">You indicated: {detail.clientResponse}</p>}
                  {detail.revisionRequestedAt && <p className="text-luxury-small text-luxury-text-muted">Revision requested {new Date(detail.revisionRequestedAt).toLocaleDateString()}</p>}

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-full bg-luxury-rose/10 px-3 py-1 text-luxury-small text-luxury-rose" onClick={() => handleResponse(p.proposalId, "accepted")}>
                      Accept
                    </button>
                    <button type="button" className="rounded-full bg-luxury-rose/10 px-3 py-1 text-luxury-small text-luxury-rose" onClick={() => handleResponse(p.proposalId, "declined")}>
                      Decline
                    </button>
                    <button type="button" className="rounded-full bg-luxury-rose/10 px-3 py-1 text-luxury-small text-luxury-rose" onClick={() => handleRequestRevision(p.proposalId)}>
                      Request Revision
                    </button>
                    <button type="button" className="rounded-full bg-luxury-rose/10 px-3 py-1 text-luxury-small text-luxury-rose" onClick={() => handleFavorite(p.proposalId, detail.favorited)}>
                      {detail.favorited ? "Favorited ★" : "Favorite"}
                    </button>
                    <button type="button" disabled className="rounded-full bg-luxury-border/30 px-3 py-1 text-luxury-small text-luxury-text-muted" title="PDF generation is not available yet.">
                      Download PDF
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </LuxuryCard>
  );
}
