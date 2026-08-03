"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientPortalInvoices } from "@/lib/data";
import type { ClientPortalInvoice } from "@/types/clientPortal";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InvoiceStatusBadge } from "@/modules/finance/components/InvoiceStatusBadge";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; invoices: ClientPortalInvoice[] };

/** Step 5's own dedicated "Upcoming Payments" surface — every outstanding Invoice with a due date, soonest first, distinct from the Overview's own single "next payment due" field. */
function UpcomingPaymentsSection({ invoices }: { invoices: ClientPortalInvoice[] }) {
  const upcoming = invoices
    .filter((invoice) => invoice.balance_minor > 0 && invoice.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  if (upcoming.length === 0) return null;

  return (
    <section aria-labelledby="upcoming-payments-heading">
      <h2 id="upcoming-payments-heading" className="mb-2 font-serif text-lg font-semibold text-text">
        Upcoming Payments
      </h2>
      <div className="space-y-2">
        {upcoming.map((invoice) => (
          <Card key={invoice.id} className="border-warning/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-text">{invoice.invoice_number}</p>
                <p className="text-xs text-text-muted">Due {new Date(invoice.due_date as string).toLocaleDateString()}</p>
              </div>
              <Badge tone="warning">{formatMoney(invoice.balance_minor, invoice.currency)}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function ClientPortalInvoicesListView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchInvoices = () =>
    getClientPortalInvoices()
      .then((invoices) => setState({ status: "ready", invoices }))
      .catch(() => setState({ status: "error" }));

  useEffect(() => {
    fetchInvoices();

  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">My Invoices</h1>

      {state.status === "loading" ? (
        <div aria-live="polite" aria-busy="true">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your invoices." onRetry={fetchInvoices} />
      ) : state.invoices.length === 0 ? (
        <EmptyState title="No invoices yet" description="Your invoices will appear here once one is issued." />
      ) : (
        <div className="space-y-6">
          <UpcomingPaymentsSection invoices={state.invoices} />

          <section aria-label="All invoices" className="space-y-3">
            {state.invoices.map((invoice) => (
              <Link key={invoice.id} href={`/client-access/invoices/${invoice.id}`}>
                <Card className="transition-colors hover:border-accent/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-serif text-[15px] font-semibold text-text">{invoice.title}</h3>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {invoice.invoice_number}
                        {invoice.due_date ? ` · Due ${new Date(invoice.due_date).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-text">{formatMoney(invoice.balance_minor, invoice.currency)} due</p>
                      <InvoiceStatusBadge status={invoice.status} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
