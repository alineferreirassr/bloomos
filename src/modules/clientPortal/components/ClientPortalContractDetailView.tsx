"use client";

import { useEffect, useState } from "react";
import { getClientPortalContractById } from "@/lib/data";
import type { ClientPortalContract } from "@/types/clientPortal";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";
import { SignatureStatusBadge } from "@/modules/contracts/components/SignatureStatusBadge";
import { formatContractValue } from "@/modules/contracts/mappers";
import { ClientPortalContractDocumentSection } from "@/modules/clientPortal/components/ClientPortalContractDocumentSection";

type LoadState = { status: "loading" } | { status: "not-found" } | { status: "error" } | { status: "ready"; contract: ClientPortalContract };

export function ClientPortalContractDetailView({ contractId }: { contractId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchContract = () =>
    getClientPortalContractById(contractId)
      .then((contract) => setState({ status: "ready", contract }))
      .catch((err) => setState({ status: err instanceof NotFoundError ? "not-found" : "error" }));

  useEffect(() => {
    fetchContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "not-found") return <ErrorState message="This contract could not be found." />;
  if (state.status === "error") return <ErrorState message="Could not load this contract." onRetry={fetchContract} />;

  const { contract } = state;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold text-text">{contract.title}</h1>
        <ContractStatusBadge status={contract.status} />
        <SignatureStatusBadge status={contract.signature_status} />
      </div>
      <p className="text-sm text-text-muted">{contract.contract_number}</p>

      <Card>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Total value" value={formatContractValue(contract.total_value, contract.currency)} />
          <Field label="Deposit" value={contract.deposit_required ? formatContractValue(contract.deposit_amount, contract.currency) : "Not required"} />
          <Field label="Remaining balance" value={formatContractValue(contract.remaining_balance, contract.currency)} />
          <Field label="Effective date" value={contract.effective_date ? new Date(contract.effective_date).toLocaleDateString() : null} />
          <Field label="Expiration date" value={contract.expiration_date ? new Date(contract.expiration_date).toLocaleDateString() : null} />
          <Field label="Sent" value={contract.sent_at ? new Date(contract.sent_at).toLocaleDateString() : null} />
          <Field label="Viewed" value={contract.viewed_at ? new Date(contract.viewed_at).toLocaleDateString() : null} />
          <Field label="Signed" value={contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : null} />
        </dl>
        {contract.description ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs text-text-muted">Description</p>
            <p className="mt-1 text-sm text-text">{contract.description}</p>
          </div>
        ) : null}
      </Card>

      <ClientPortalContractDocumentSection contractId={contract.id} />
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
