"use client";

import { useRouter } from "next/navigation";
import { createLead } from "@/lib/data";
import { LeadForm } from "@/modules/leads/components/LeadForm";

export function NewLeadView() {
  const router = useRouter();

  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">New Lead</h2>
      <div className="mt-6 max-w-3xl">
        <LeadForm
          submitLabel="Create Lead"
          cancelHref="/leads"
          onSubmit={async (input) => {
            const result = await createLead(input);
            if (result.success) {
              router.push(`/leads/${result.data.id}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
