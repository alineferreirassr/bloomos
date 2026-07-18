"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientPortalContracts } from "@/lib/data";
import type { ClientPortalContract } from "@/types/clientPortal";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";
import { SignatureStatusBadge } from "@/modules/contracts/components/SignatureStatusBadge";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; contracts: ClientPortalContract[] };

export function ClientPortalContractsListView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchContracts = () =>
    getClientPortalContracts()
      .then((contracts) => setState({ status: "ready", contracts }))
      .catch(() => setState({ status: "error" }));

  useEffect(() => {
    fetchContracts();
     
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">My Contracts</h1>

      {state.status === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your contracts." onRetry={fetchContracts} />
      ) : state.contracts.length === 0 ? (
        <EmptyState title="No contracts yet" description="Your contracts will appear here once one is prepared." />
      ) : (
        <div className="space-y-3">
          {state.contracts.map((contract) => (
            <Link key={contract.id} href={`/client-access/contracts/${contract.id}`}>
              <Card className="transition-colors hover:border-accent/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-[15px] font-semibold text-text">{contract.title}</h3>
                    <p className="mt-0.5 text-xs text-text-muted">{contract.contract_number}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <ContractStatusBadge status={contract.status} />
                    <SignatureStatusBadge status={contract.signature_status} />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
