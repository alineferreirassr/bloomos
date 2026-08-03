"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  getClientPortalContractDocumentAction,
  compareClientPortalContractVersionsAction,
  requestClientPortalContractReviewAction,
  type ClientPortalContractDocumentSummary,
} from "@/modules/clientPortal/getClientPortalContract";
import type { ContractComparisonResult } from "@/types/contractPlatform";

/**
 * v2.0 Checkpoint 34, Step 12 — additive, read-only "Contract Document"
 * card on the Client Portal's Contract Detail page. No signing; the real
 * send/view/sign flow above this card is untouched.
 *
 * Checkpoint 36, Step 4 — extended with "Download Placeholder" (a real
 * `LuxuryClientDashboardShell`-style disabled control, same as Invoice's
 * own PDF placeholder) and "Review Requests" (posts through the existing
 * Comments Platform — see `requestClientPortalContractReviewAction`'s
 * own doc comment).
 */
export function ClientPortalContractDocumentSection({ contractId }: { contractId: string }) {
  const [summary, setSummary] = useState<ClientPortalContractDocumentSummary | null | "loading">("loading");
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [comparison, setComparison] = useState<ContractComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [requestingReview, setRequestingReview] = useState(false);
  const [reviewRequested, setReviewRequested] = useState(false);

  useEffect(() => {
    getClientPortalContractDocumentAction(contractId).then((result) => setSummary(result.success ? result.data : null));
  }, [contractId]);

  if (summary === "loading") return null;
  if (summary === null) return null;

  const handleCompare = async () => {
    if (compareA === null || compareB === null) return;
    setComparing(true);
    const result = await compareClientPortalContractVersionsAction(contractId, compareA, compareB);
    setComparing(false);
    if (result.success) setComparison(result.data);
  };

  const handleRequestReview = async () => {
    const note = reviewNote.trim();
    if (!note) return;
    setRequestingReview(true);
    const result = await requestClientPortalContractReviewAction(contractId, note);
    setRequestingReview(false);
    if (result.success) {
      setReviewNote("");
      setReviewRequested(true);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-[17px] font-semibold text-text">Contract Document</h3>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">v{summary.currentVersionNumber}</Badge>
          <Button variant="ghost" disabled title="PDF generation is not available yet.">
            Download PDF
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {summary.sections.map((section) => (
          <div key={section.key}>
            <h4 className="text-sm font-semibold text-text">{section.title}</h4>
            {section.blocks.map((block, i) => (
              <div key={i} className="mt-1">
                {block.heading ? <p className="text-sm font-medium text-text">{block.heading}</p> : null}
                {block.text ? <p className="text-sm text-text-muted">{block.text}</p> : null}
              </div>
            ))}
          </div>
        ))}

        {summary.clauses.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-text">Clauses</h4>
            <ul className="mt-1 space-y-2">
              {summary.clauses.map((clause) => (
                <li key={clause.key}>
                  <p className="text-sm font-medium text-text">{clause.name}</p>
                  <p className="text-sm text-text-muted">{clause.bodyText}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {summary.terms ? (
          <div>
            <h4 className="text-sm font-semibold text-text">Terms</h4>
            <p className="mt-1 text-sm text-text-muted">{summary.terms}</p>
          </div>
        ) : null}

        {summary.policies ? (
          <div>
            <h4 className="text-sm font-semibold text-text">Policies</h4>
            <p className="mt-1 text-sm text-text-muted">{summary.policies}</p>
          </div>
        ) : null}

        {summary.exhibits.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-text">Attachments</h4>
            <ul className="mt-1 space-y-1 text-sm text-text-muted">
              {summary.exhibits.map((exhibit) => (
                <li key={exhibit.id}>{exhibit.title}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {summary.availableVersionNumbers.length > 1 ? (
          <div>
            <h4 className="text-sm font-semibold text-text">Compare Versions</h4>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Select value={compareA ?? ""} onChange={(e) => setCompareA(e.target.value ? Number(e.target.value) : null)} className="max-w-[8rem]">
                <option value="">—</option>
                {summary.availableVersionNumbers.map((n) => (
                  <option key={n} value={n}>
                    v{n}
                  </option>
                ))}
              </Select>
              <Select value={compareB ?? ""} onChange={(e) => setCompareB(e.target.value ? Number(e.target.value) : null)} className="max-w-[8rem]">
                <option value="">—</option>
                {summary.availableVersionNumbers.map((n) => (
                  <option key={n} value={n}>
                    v{n}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={handleCompare} disabled={compareA === null || compareB === null || comparing}>
                {comparing ? "Comparing…" : "Compare"}
              </Button>
            </div>
            {comparison ? (
              <ul className="mt-2 space-y-1 text-xs text-text-muted">
                {comparison.diffs.map((d, i) => (
                  <li key={i}>
                    [{d.category}] {d.field}: {d.changeType}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-text">Request a Review</h4>
          <p className="mt-0.5 text-xs text-text-muted">Ask your planning team to take another look before you sign.</p>
          {reviewRequested ? (
            <p className="mt-2 text-sm text-text">Your review request has been sent.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label htmlFor="contract-review-note" className="sr-only">
                What would you like reviewed?
              </label>
              <input
                id="contract-review-note"
                type="text"
                placeholder="What would you like reviewed?"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
              />
              <Button type="button" variant="secondary" disabled={requestingReview || !reviewNote.trim()} onClick={handleRequestReview}>
                {requestingReview ? "Sending…" : "Request Review"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
