"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { createExpense } from "@/lib/data";
import { ExpenseForm } from "@/modules/finance/components/ExpenseForm";
import { expenseFormToInput, type ExpenseInput } from "@/modules/finance/schema";

interface NewExpenseViewProps {
  defaultEventId?: string;
  defaultClientId?: string;
  defaultContractId?: string;
}

/** Plain JSON-shaped payload (strings/numbers/null/booleans, fixed key order from expenseFormToInput) — string comparison is a safe, simple deep-equality check. */
function expensePayloadsEqual(a: ExpenseInput, b: ExpenseInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function NewExpenseView({ defaultEventId, defaultClientId, defaultContractId }: NewExpenseViewProps) {
  const router = useRouter();

  /**
   * Finance F2.1C-F-E-D-B2: expenseId is generated lazily, exactly once per
   * page mount — same lifecycle NewInvoiceView/NewPaymentView use.
   * lastPayload tracks what was actually submitted under the current id:
   * unset on the very first submit (reuse the id as-is), unchanged on a
   * retry (reuse the same id), and a new id is generated only when the
   * Founder edits the form after a failed attempt. Owned entirely here,
   * not inside ExpenseForm — ExpenseForm is shared with EditExpenseView,
   * which must never inherit create-request identity.
   */
  const requestRef = useRef<{ id: string; lastPayload: ExpenseInput | null } | null>(null);
  if (requestRef.current === null) {
    requestRef.current = { id: crypto.randomUUID(), lastPayload: null };
  }

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
            const payload = expenseFormToInput(input);
            const request = requestRef.current!;
            const payloadChanged = request.lastPayload !== null && !expensePayloadsEqual(request.lastPayload, payload);
            const expenseId = payloadChanged ? crypto.randomUUID() : request.id;
            requestRef.current = { id: expenseId, lastPayload: payload };

            const result = await createExpense(payload, expenseId);
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
