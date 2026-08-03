"use client";

import { useEffect, useState } from "react";
import { getClientSafeReportAction, type ClientSafeReport } from "@/modules/reporting/clientSafeReportActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatMoney } from "@/lib/money";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; report: ClientSafeReport };

function formatDate(iso: string | null): string {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * v2.0 Checkpoint 42, Step 13 — the Client Portal's own Reporting surface:
 * one consolidated, read-only status summary over the journey/proposal/
 * contract/invoice/event/document data the individual `/client-access/*`
 * pages already show one-at-a-time. Every field comes straight from
 * `getClientSafeReportAction()`'s strict allowlist — this component never
 * fetches or composes anything internal itself.
 */
export function ClientSafeReportView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    getClientSafeReportAction().then((result) => {
      if (result.success) setState({ status: "ready", report: result.data });
      else setState({ status: "error", message: result.error });
    });
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} />;
  }

  const { report } = state;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">{report.journey.currentStageLabel}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{report.journey.progressPercentage}% complete{report.journey.nextStepLabel ? ` — next: ${report.journey.nextStepLabel}` : ""}</p>
        {report.milestones.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {report.milestones.map((milestone) => (
              <li key={milestone}>
                <Badge tone="success">{milestone}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold">Proposals</h3>
        {report.proposals.length === 0 ? (
          <EmptyState title="No proposals yet" description="Proposals sent to you will appear here." />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {report.proposals.map((proposal) => (
              <li key={proposal.id} className="flex items-center justify-between text-sm">
                <span>{proposal.title}</span>
                <span className="text-muted-foreground">{proposal.sentAt ? `Sent ${formatDate(proposal.sentAt)}` : "Draft"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold">Contracts</h3>
        {report.contracts.length === 0 ? (
          <EmptyState title="No contracts yet" description="Contracts will appear here once sent." />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {report.contracts.map((contract) => (
              <li key={contract.id} className="flex items-center justify-between text-sm">
                <span>{contract.title}</span>
                <Badge tone={contract.signatureStatus === "signed" ? "success" : "neutral"}>{contract.signatureStatus}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold">Payment schedule</h3>
        {report.paymentSchedule.length === 0 ? (
          <EmptyState title="No invoices yet" description="Your payment schedule will appear here." />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {report.paymentSchedule.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between text-sm">
                <span>
                  {invoice.invoiceNumber} — due {formatDate(invoice.dueDate)}
                </span>
                <span className="text-muted-foreground">
                  {formatMoney(invoice.balanceMinor, invoice.currency)} due of {formatMoney(invoice.totalMinor, invoice.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold">Event readiness</h3>
        {report.events.length === 0 ? (
          <EmptyState title="No events yet" description="Your events will appear here." />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {report.events.map((event) => (
              <li key={event.id} className="flex items-center justify-between text-sm">
                <span>{event.title}</span>
                <span className="text-muted-foreground">{formatDate(event.eventDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold">Recent document activity</h3>
        {report.recentDocumentActivity.length === 0 ? (
          <EmptyState title="No documents yet" description="Shared documents will appear here." />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {report.recentDocumentActivity.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between text-sm">
                <span>{doc.title}</span>
                <span className="text-muted-foreground">{formatDate(doc.uploadedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
