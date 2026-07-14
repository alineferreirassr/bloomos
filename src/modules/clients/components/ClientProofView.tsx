"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientById } from "@/lib/data";
import type { Client } from "@/types/client";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; client: Client };

export function ClientProofView({ clientId }: { clientId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getClientById(clientId)
      .then((client) => {
        if (!cancelled) setState({ status: "ready", client });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: err instanceof NotFoundError ? "not-found" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (state.status === "loading") {
    return <Skeleton className="h-40 w-full" />;
  }

  if (state.status === "not-found") {
    return <ErrorState message="This client could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this client." />;
  }

  const { client } = state;

  return (
    <div>
      <h2 className="text-xl font-semibold text-text">
        {client.first_name} {client.last_name}
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Full Clients module isn&apos;t built yet — this record proves the
        Lead-to-Client conversion worked.
      </p>
      <Card className="mt-6 max-w-md">
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-text-muted">Email</dt>
            <dd className="text-sm text-text">{client.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Phone</dt>
            <dd className="text-sm text-text">{client.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Returning client</dt>
            <dd className="text-sm text-text">{client.is_returning ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Converted from Lead</dt>
            <dd className="text-sm text-text">
              <Link
                href={`/leads/${client.origin_lead_id}`}
                className="text-accent hover:underline"
              >
                View original Lead →
              </Link>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
