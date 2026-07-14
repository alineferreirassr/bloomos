"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/data";
import { ClientForm } from "@/modules/clients/components/ClientForm";

export function NewClientView() {
  const router = useRouter();

  return (
    <div>
      <h2 className="text-xl font-semibold text-text">New Client</h2>
      <p className="mt-1 text-sm text-text-muted">
        Creating a Client here does not require an originating Lead.
      </p>
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
