"use client";

import { useRouter } from "next/navigation";
import { createContract } from "@/lib/data";
import { ContractForm } from "@/modules/contracts/components/ContractForm";
import { contractFormToInput } from "@/modules/contracts/schema";

export function NewContractView() {
  const router = useRouter();

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">New Contract</h2>
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
