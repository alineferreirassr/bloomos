"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientPortalOverview, updateClientLastAccess } from "@/lib/data";
import { useClientAccountSession } from "@/components/providers/ClientAccountSessionProvider";
import type { ClientPortalOverview } from "@/types/clientPortal";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatMoney } from "@/lib/money";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; overview: ClientPortalOverview };

/**
 * Client Portal Overview (`/client-access`) — the real implementation,
 * consuming `getClientPortalOverview()` (client-safe, scoped entirely by
 * RLS/the client-safe repository, never internal metrics/expenses/notes).
 * Cards hide cleanly when there's nothing to show — an empty portfolio
 * never renders a broken or misleading card.
 */
export function ClientAccessLandingView() {
  const session = useClientAccountSession();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchOverview = () =>
    getClientPortalOverview()
      .then((overview) => setState({ status: "ready", overview }))
      .catch(() => setState({ status: "error" }));

  useEffect(() => {
    updateClientLastAccess(session.accountId);
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-text">Welcome, {session.clientName || "there"}</h1>
        <p className="mt-1 text-sm text-text-muted">Your {session.workspaceName} Client Portal account.</p>
      </div>

      {state.status === "loading" ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your overview." onRetry={fetchOverview} />
      ) : (
        <OverviewContent overview={state.overview} />
      )}
    </div>
  );
}

function OverviewContent({ overview }: { overview: ClientPortalOverview }) {
  const hasNothing =
    !overview.upcomingEvent && overview.contractsInProgress === 0 && !overview.nextPaymentDue && overview.recentDocuments.length === 0;

  return (
    <div className="space-y-4">
      {overview.nextRecommendedAction ? (
        <Card className="border-accent/40 bg-accent/5">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Next recommended action</p>
          <p className="mt-1 text-sm text-text">{overview.nextRecommendedAction}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {overview.upcomingEvent ? (
          <Card>
            <h3 className="font-serif text-[15px] font-semibold text-text">Upcoming Event</h3>
            <p className="mt-1 text-sm text-text">{overview.upcomingEvent.title}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {overview.upcomingEvent.event_date ? new Date(overview.upcomingEvent.event_date).toLocaleDateString() : "Date TBD"}
            </p>
            <Link href={`/client-access/events/${overview.upcomingEvent.id}`} className="mt-2 inline-block text-xs text-accent hover:underline">
              View event →
            </Link>
          </Card>
        ) : null}

        {overview.contractsInProgress > 0 ? (
          <Card>
            <h3 className="font-serif text-[15px] font-semibold text-text">Contracts</h3>
            <p className="mt-1 text-sm text-text">{overview.contractsInProgress} in progress</p>
            <Link href="/client-access/contracts" className="mt-2 inline-block text-xs text-accent hover:underline">
              View contracts →
            </Link>
          </Card>
        ) : null}

        {overview.nextPaymentDue ? (
          <Card>
            <h3 className="font-serif text-[15px] font-semibold text-text">Next Payment Due</h3>
            <p className="mt-1 text-sm text-text">
              {formatMoney(overview.nextPaymentDue.balanceMinor, overview.currency)}
              {overview.nextPaymentDue.dueDate ? ` — due ${new Date(overview.nextPaymentDue.dueDate).toLocaleDateString()}` : ""}
            </p>
            <Link href={`/client-access/invoices/${overview.nextPaymentDue.invoiceId}`} className="mt-2 inline-block text-xs text-accent hover:underline">
              View invoice →
            </Link>
          </Card>
        ) : overview.totalOutstandingBalanceMinor > 0 ? (
          <Card>
            <h3 className="font-serif text-[15px] font-semibold text-text">Outstanding Balance</h3>
            <p className="mt-1 text-sm text-text">{formatMoney(overview.totalOutstandingBalanceMinor, overview.currency)}</p>
            <Link href="/client-access/invoices" className="mt-2 inline-block text-xs text-accent hover:underline">
              View invoices →
            </Link>
          </Card>
        ) : null}

        {overview.recentDocuments.length > 0 ? (
          <Card>
            <h3 className="font-serif text-[15px] font-semibold text-text">Recent Documents</h3>
            <ul className="mt-2 space-y-1">
              {overview.recentDocuments.slice(0, 3).map((doc) => (
                <li key={doc.id} className="truncate text-xs text-text">
                  <Link href={`/client-access/documents/${doc.id}`} className="hover:underline">
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/client-access/documents" className="mt-2 inline-block text-xs text-accent hover:underline">
              View documents →
            </Link>
          </Card>
        ) : null}
      </div>

      {hasNothing ? (
        <Card>
          <p className="text-sm text-text-muted">Nothing to show yet. Check back once your event, contracts, or invoices are underway.</p>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text">Account status</span>
          <Badge tone="accent">Active</Badge>
        </div>
      </Card>
    </div>
  );
}
