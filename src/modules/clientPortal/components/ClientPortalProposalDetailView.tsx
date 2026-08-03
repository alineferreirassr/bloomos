"use client";

import { useEffect, useState } from "react";
import {
  getClientPortalProposalAction,
  compareClientPortalProposalVersionsAction,
  requestProposalRevisionAction,
  submitClientProposalResponseAction,
  toggleFavoriteProposalAction,
  type ClientPortalProposalSummary,
} from "@/modules/clientPortal/getClientPortalProposal";
import type { ProposalComparisonResult } from "@/types/proposalPlatform";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; proposal: ClientPortalProposalSummary };

const STATUS_TONE: Record<string, BadgeTone> = { accepted: "success", declined: "danger", sent: "outline" };
const STATUS_LABEL: Record<string, string> = { accepted: "Accepted", declined: "Declined", sent: "Sent" };

function formatMoney(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor === null || minor === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(minor / 100);
}

/**
 * Checkpoint 36, Step 3 — the Proposal Center's own detail page. Every
 * field/action composes `getClientPortalProposal.ts`'s existing,
 * already-tested actions (Checkpoint 33) — Status (derived from
 * `clientResponse`), Versions/History (`availableVersionNumbers`),
 * Comparison (`compareClientPortalProposalVersionsAction`), Accept/Decline
 * Placeholders, and Revision Requests. No new proposal business logic.
 */
export function ClientPortalProposalDetailView({ proposalId }: { proposalId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [comparison, setComparison] = useState<ProposalComparisonResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const fetchProposal = () =>
    getClientPortalProposalAction(proposalId).then((result) => {
      if (result.success) setState({ status: "ready", proposal: result.data });
      else setState({ status: "error" });
    });

  useEffect(() => {
    fetchProposal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

  async function handleResponse(response: "accepted" | "declined") {
    setBusy(true);
    await submitClientProposalResponseAction(proposalId, response);
    setBusy(false);
    fetchProposal();
  }

  async function handleFavorite(favorited: boolean) {
    setBusy(true);
    await toggleFavoriteProposalAction(proposalId, !favorited);
    setBusy(false);
    fetchProposal();
  }

  async function handleRequestRevision() {
    const note = revisionNote.trim();
    if (!note) return;
    setBusy(true);
    const result = await requestProposalRevisionAction(proposalId, note);
    setBusy(false);
    if (result.success) {
      setRevisionNote("");
      fetchProposal();
    }
  }

  async function handleCompare() {
    setCompareError(null);
    setComparison(null);
    if (compareA === null || compareB === null) return;
    const result = await compareClientPortalProposalVersionsAction(proposalId, compareA, compareB);
    if (result.success) setComparison(result.data);
    else setCompareError(result.error);
  }

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message="Could not load this proposal." onRetry={fetchProposal} />;

  const { proposal } = state;
  const statusKey = proposal.clientResponse ?? "sent";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold text-text">{proposal.title}</h1>
        <Badge tone={STATUS_TONE[statusKey]}>{STATUS_LABEL[statusKey]}</Badge>
      </div>
      {proposal.heroHeadline ? <p className="text-sm text-text-muted">{proposal.heroHeadline}</p> : null}

      <Card>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Current version" value={proposal.currentVersionNumber !== null ? `v${proposal.currentVersionNumber}` : null} />
          <Field label="Grand total" value={proposal.pricing ? formatMoney(proposal.pricing.grandTotal_minor, proposal.pricing.currency) : null} />
          <Field label="Deposit due" value={proposal.pricing ? formatMoney(proposal.pricing.depositDue_minor, proposal.pricing.currency) : null} />
          <Field label="Remaining balance" value={proposal.pricing ? formatMoney(proposal.pricing.remainingBalance_minor, proposal.pricing.currency) : null} />
        </dl>
        {proposal.revisionRequestedAt ? <p className="mt-3 text-xs text-text-muted">Revision requested {new Date(proposal.revisionRequestedAt).toLocaleDateString()}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" disabled={busy || proposal.clientResponse === "accepted"} onClick={() => handleResponse("accepted")}>
            Accept
          </Button>
          <Button type="button" variant="secondary" disabled={busy || proposal.clientResponse === "declined"} onClick={() => handleResponse("declined")}>
            Decline
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => handleFavorite(proposal.favorited)}>
            {proposal.favorited ? "Favorited ★" : "Favorite"}
          </Button>
          <Button type="button" variant="ghost" disabled title="PDF generation is not available yet.">
            Download PDF
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Request a Revision</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="revision-note" className="sr-only">
            What would you like changed?
          </label>
          <input
            id="revision-note"
            type="text"
            placeholder="What would you like changed?"
            value={revisionNote}
            onChange={(event) => setRevisionNote(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
          />
          <Button type="button" variant="ghost" disabled={busy || !revisionNote.trim()} onClick={handleRequestRevision}>
            Request Revision
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Versions &amp; History</h2>
        <ul role="list" className="mb-4 flex flex-wrap gap-1.5">
          {proposal.availableVersionNumbers.map((versionNumber) => (
            <li key={versionNumber}>
              <Badge tone={versionNumber === proposal.currentVersionNumber ? "accent" : "neutral"}>v{versionNumber}</Badge>
            </li>
          ))}
        </ul>

        {proposal.availableVersionNumbers.length > 1 ? (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm font-medium text-text">Compare Versions</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={compareA ?? ""} onChange={(event) => setCompareA(event.target.value ? Number(event.target.value) : null)} className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm text-text">
                <option value="">Version A</option>
                {proposal.availableVersionNumbers.map((v) => (
                  <option key={v} value={v}>
                    v{v}
                  </option>
                ))}
              </select>
              <span className="text-sm text-text-muted">vs</span>
              <select value={compareB ?? ""} onChange={(event) => setCompareB(event.target.value ? Number(event.target.value) : null)} className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm text-text">
                <option value="">Version B</option>
                {proposal.availableVersionNumbers.map((v) => (
                  <option key={v} value={v}>
                    v{v}
                  </option>
                ))}
              </select>
              <Button type="button" variant="ghost" disabled={compareA === null || compareB === null} onClick={handleCompare}>
                Compare
              </Button>
            </div>

            {compareError ? <p className="text-sm text-danger">{compareError}</p> : null}

            {comparison ? (
              comparison.hasChanges ? (
                <ul role="list" className="space-y-1.5">
                  {comparison.diffs.map((diff, index) => (
                    <li key={`${diff.category}-${diff.field}-${index}`} className="text-sm text-text">
                      <span className="font-medium">{diff.field}</span>: {diff.before ?? "—"} → {diff.after ?? "—"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">No differences between v{comparison.versionANumber} and v{comparison.versionBNumber}.</p>
              )
            ) : null}
          </div>
        ) : null}
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
