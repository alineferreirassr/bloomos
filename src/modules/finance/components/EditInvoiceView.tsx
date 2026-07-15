"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getInvoiceById, updateInvoice } from "@/lib/data";
import type { Invoice } from "@/types/invoice";
import { NotFoundError } from "@/core/errors";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { InvoiceForm } from "@/modules/finance/components/InvoiceForm";
import { invoiceFormToInput } from "@/modules/finance/schema";
import { invoiceToFormInput } from "@/modules/finance/mappers";
import { isInvoiceTerminal } from "@/core/workflows/invoiceWorkflow";
import { INVOICE_STATUS_LABELS } from "@/core/enums/invoiceStatus";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; invoice: Invoice };

/**
 * updateInvoice() (lib/data/index.ts) rejects a client_id change and a
 * voided/archived invoice outright — the Client select and the whole form
 * are disabled/hidden accordingly here rather than letting the user hit a
 * server error, the same precedent as EditContractView.
 */
export function EditInvoiceView({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getInvoiceById(invoiceId)
      .then((invoice) => {
        if (!cancelled) setState({ status: "ready", invoice });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: err instanceof NotFoundError ? "not-found" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This invoice could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this invoice." />;
  }

  const { invoice } = state;

  if (isInvoiceTerminal(invoice.status)) {
    return (
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">Edit {invoice.title}</h2>
        <p className="mt-4 text-sm text-text-muted">
          This invoice is {INVOICE_STATUS_LABELS[invoice.status].toLowerCase()} and can&apos;t be edited.
        </p>
        <Link href={`/finance/invoices/${invoiceId}`} className="mt-4 inline-block text-sm text-accent hover:underline">
          ← Back to invoice
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">Edit {invoice.title}</h2>
      <div className="mt-6 max-w-3xl">
        <InvoiceForm
          submitLabel="Save changes"
          cancelHref={`/finance/invoices/${invoiceId}`}
          defaultValues={invoiceToFormInput(invoice)}
          disableClientChange
          onSubmit={async (input) => {
            const result = await updateInvoice(invoiceId, invoiceFormToInput(input));
            if (result.success) {
              router.push(`/finance/invoices/${invoiceId}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
