"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listClientPortalProposalsAction } from "@/modules/clientPortal/getClientPortalProposal";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type ProposalListItem = { proposalId: string; title: string; grandTotal_minor: number | null; currency: string | null; sentAt: string | null };
type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; proposals: ProposalListItem[] };

function formatMoney(minor: number | null, currency: string | null): string {
  if (minor === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(minor / 100);
}

/**
 * Checkpoint 36, Step 3 — the Proposal Center's own "All Proposals" list.
 * Composes `listClientPortalProposalsAction` (Checkpoint 33) directly —
 * only ever the proposals already sent to this client. Mirrors
 * `ClientPortalContractsListView.tsx`'s own list-page convention.
 */
export function ClientPortalProposalsListView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchProposals = () =>
    listClientPortalProposalsAction().then((result) => {
      if (result.success) setState({ status: "ready", proposals: result.data });
      else setState({ status: "error" });
    });

  useEffect(() => {
    fetchProposals();

  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">My Proposals</h1>

      {state.status === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your proposals." onRetry={fetchProposals} />
      ) : state.proposals.length === 0 ? (
        <EmptyState title="No proposals yet" description="Proposals sent to you will appear here." />
      ) : (
        <div className="space-y-3">
          {state.proposals.map((proposal) => (
            <Link key={proposal.proposalId} href={`/client-access/proposals/${proposal.proposalId}`}>
              <Card className="transition-colors hover:border-accent/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-[15px] font-semibold text-text">{proposal.title}</h3>
                  <span className="text-sm text-text-muted">{formatMoney(proposal.grandTotal_minor, proposal.currency)}</span>
                </div>
                {proposal.sentAt ? <p className="mt-0.5 text-xs text-text-muted">Sent {new Date(proposal.sentAt).toLocaleDateString()}</p> : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
