"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientById, updateClient } from "@/lib/data";
import type { Client } from "@/types/client";
import { NotFoundError } from "@/core/errors";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ClientForm } from "@/modules/clients/components/ClientForm";
import { clientToFormInput } from "@/modules/clients/mappers";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; client: Client };

export function EditClientView({ clientId }: { clientId: string }) {
  const router = useRouter();
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
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This client could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this client." />;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text">
        Edit {state.client.first_name} {state.client.last_name}
      </h2>
      <div className="mt-6 max-w-3xl">
        <ClientForm
          submitLabel="Save changes"
          cancelHref={`/clients/${clientId}`}
          defaultValues={clientToFormInput(state.client)}
          onSubmit={async (input) => {
            const result = await updateClient(clientId, input);
            if (result.success) {
              router.push(`/clients/${clientId}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
