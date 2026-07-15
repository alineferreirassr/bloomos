"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getContract, updateContract } from "@/lib/data";
import type { Contract } from "@/types/contract";
import { NotFoundError } from "@/core/errors";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ContractForm } from "@/modules/contracts/components/ContractForm";
import { contractFormToInput } from "@/modules/contracts/schema";
import { contractToFormInput } from "@/modules/contracts/mappers";
import { isContractCommercialLocked, isContractFullyLocked } from "@/core/workflows/contractWorkflow";
import { CONTRACT_STATUS_LABELS } from "@/core/enums/contractStatus";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; contract: Contract };

/**
 * updateContract() (lib/data/index.ts) rejects a client_id change and an
 * archived contract outright — the Client select and the whole form are
 * disabled/hidden accordingly here rather than letting the user hit a
 * server error. isContractFullyLocked/isContractCommercialLocked
 * (core/workflows/contractWorkflow.ts) are the single source of truth for
 * both tiers, matching the phase spec's read-only rules exactly.
 */
export function EditContractView({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getContract(contractId)
      .then((contract) => {
        if (!cancelled) setState({ status: "ready", contract });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: err instanceof NotFoundError ? "not-found" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This contract could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this contract." />;
  }

  const { contract } = state;

  if (isContractFullyLocked(contract.status)) {
    return (
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">Edit {contract.title}</h2>
        <p className="mt-4 text-sm text-text-muted">
          This contract is {CONTRACT_STATUS_LABELS[contract.status].toLowerCase()} and can&apos;t be edited.
        </p>
        <Link href={`/contracts/${contractId}`} className="mt-4 inline-block text-sm text-accent hover:underline">
          ← Back to contract
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">Edit {contract.title}</h2>
      <div className="mt-6 max-w-3xl">
        <ContractForm
          submitLabel="Save changes"
          cancelHref={`/contracts/${contractId}`}
          defaultValues={contractToFormInput(contract)}
          disableClientChange
          lockCommercialTerms={isContractCommercialLocked(contract.status)}
          onSubmit={async (input) => {
            const result = await updateContract(contractId, contractFormToInput(input));
            if (result.success) {
              router.push(`/contracts/${contractId}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
