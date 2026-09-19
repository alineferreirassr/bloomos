"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClientForm } from "@/modules/clients/components/ClientForm";

export function NewClientView() {
  const router = useRouter();

  return (
    // GLOBAL-VISUAL-04R — same AF-ported form pattern as Leads' New/Edit.
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Client"
        title="New Client"
        subtitle="Creating a Client here does not require an originating Lead."
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Clients", href: "/clients" }, { label: "New" }]}
      />
      <div className="mt-6 max-w-3xl">
        <ClientForm
          submitLabel="Create Client"
          cancelHref="/clients"
          onSubmit={async (input) => {
            const result = await createClient(input);
            if (result.success) {
              router.push(`/clients/${result.data.id}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
