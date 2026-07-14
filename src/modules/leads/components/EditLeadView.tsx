"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeadById, updateLead } from "@/lib/data";
import type { Lead } from "@/types/lead";
import { NotFoundError } from "@/core/errors";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { LeadForm } from "@/modules/leads/components/LeadForm";
import { leadToFormInput } from "@/modules/leads/mappers";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; lead: Lead };

export function EditLeadView({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getLeadById(leadId)
      .then((lead) => {
        if (!cancelled) setState({ status: "ready", lead });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: err instanceof NotFoundError ? "not-found" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This lead could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this lead." />;
  }

  if (state.lead.status === "converted") {
    return (
      <ErrorState message="This lead was converted to a Client and is read-only. It can no longer be edited." />
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">
        Edit {state.lead.first_name} {state.lead.last_name}
      </h2>
      <div className="mt-6 max-w-3xl">
        <LeadForm
          submitLabel="Save changes"
          cancelHref={`/leads/${leadId}`}
          defaultValues={leadToFormInput(state.lead)}
          onSubmit={async (input) => {
            const result = await updateLead(leadId, input);
            if (result.success) {
              router.push(`/leads/${leadId}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
