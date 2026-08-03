"use client";

import { useRouter } from "next/navigation";
import { createExpense } from "@/lib/data";
import { ExpenseForm } from "@/modules/finance/components/ExpenseForm";
import { expenseFormToInput } from "@/modules/finance/schema";

interface NewExpenseViewProps {
  defaultEventId?: string;
  defaultClientId?: string;
  defaultContractId?: string;
}

export function NewExpenseView({ defaultEventId, defaultClientId, defaultContractId }: NewExpenseViewProps) {
  const router = useRouter();

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">New Expense</h2>
      <div className="mt-6 max-w-3xl">
        <ExpenseForm
          submitLabel="Create Expense"
          cancelHref="/finance/expenses"
          defaultValues={{
            event_id: defaultEventId ?? "",
            client_id: defaultClientId ?? "",
            contract_id: defaultContractId ?? "",
          }}
          onSubmit={async (input) => {
            const result = await createExpense(expenseFormToInput(input));
            if (result.success) {
              router.push(`/finance/expenses/${result.data.id}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
