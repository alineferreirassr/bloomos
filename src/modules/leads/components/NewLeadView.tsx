"use client";

import { useRouter } from "next/navigation";
import { createLead } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { LeadForm } from "@/modules/leads/components/LeadForm";

export function NewLeadView() {
  const router = useRouter();

  return (
    // GLOBAL-VISUAL-04R — same AF-ported detail/form pattern as
    // LeadDetailView (real PageHeader + breadcrumb, matching AF's own
    // real Leads "new" page, app/(app)/app/leads/new/page.tsx).
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Lead"
        title="New Lead"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Leads", href: "/leads" }, { label: "New" }]}
      />
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
