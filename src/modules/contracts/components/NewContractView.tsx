"use client";

import { useRouter } from "next/navigation";
import { createContract } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContractForm } from "@/modules/contracts/components/ContractForm";
import { contractFormToInput } from "@/modules/contracts/schema";

export function NewContractView() {
  const router = useRouter();

  return (
    // GLOBAL-VISUAL-04R — same AF-ported form pattern as Leads/Clients New.
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Contract"
        title="New Contract"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Contracts", href: "/contracts" }, { label: "New" }]}
      />
      <div className="mt-6 max-w-3xl">
        <ContractForm
          submitLabel="Create Contract"
          cancelHref="/contracts"
          onSubmit={async (input) => {
            const result = await createContract(contractFormToInput(input));
            if (result.success) {
              router.push(`/contracts/${result.data.id}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
