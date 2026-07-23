"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getChartOfAccounts, recordManualAdjustment } from "@/lib/data";
import type { ChartOfAccount } from "@/types/chartOfAccount";
import {
  manualAdjustmentFormSchema,
  manualAdjustmentFormToInput,
  type ManualAdjustmentFormInput,
} from "@/modules/finance/schema";
import { formatMoney, majorToMinor } from "@/lib/money";

const emptyLine = { account_id: "", debit: "", credit: "", line_memo: "" };

const emptyDefaults: ManualAdjustmentFormInput = {
  entry_date: new Date().toISOString().slice(0, 10),
  memo: "",
  lines: [{ ...emptyLine }, { ...emptyLine }],
};

/**
 * account_id options come from listChartOfAccounts (active only) — no
 * account creation happens here, matching the Chart of Accounts page's own
 * read-only scope. Line minimum is enforced twice: the zod schema rejects
 * fewer than two on submit, and Remove is disabled once exactly two remain
 * so a user can never reach an invalid state through the UI itself.
 */
export function ManualAdjustmentForm() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ChartOfAccount[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ManualAdjustmentFormInput>({
    resolver: zodResolver(manualAdjustmentFormSchema),
    defaultValues: emptyDefaults,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = watch("lines");

  useEffect(() => {
    let cancelled = false;
    getChartOfAccounts().then((result) => {
      if (!cancelled) setAccounts(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalDebitMinor = lines.reduce((sum, line) => sum + (line.debit ? majorToMinor(Number(line.debit) || 0) : 0), 0);
  const totalCreditMinor = lines.reduce((sum, line) => sum + (line.credit ? majorToMinor(Number(line.credit) || 0) : 0), 0);
  const isBalanced = totalDebitMinor > 0 && totalDebitMinor === totalCreditMinor;

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await recordManualAdjustment(manualAdjustmentFormToInput(values));
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    router.push(`/finance/journal/${result.data.id}`);
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {formError ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {formError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Entry date" htmlFor="entry_date" required error={errors.entry_date?.message}>
          <Input id="entry_date" type="date" invalid={!!errors.entry_date} {...register("entry_date")} />
        </FormField>
      </div>

      <FormField label="Memo" htmlFor="memo" required error={errors.memo?.message}>
        <Textarea id="memo" rows={2} invalid={!!errors.memo} {...register("memo")} />
      </FormField>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Lines</h3>
          <Button type="button" variant="secondary" onClick={() => append({ ...emptyLine })}>
            Add line
          </Button>
        </div>
        {errors.lines?.message ? (
          <p role="alert" className="mt-1.5 text-xs text-danger">
            {errors.lines.message}
          </p>
        ) : null}

        <div className="mt-3 space-y-3">
          {fields.map((field, index) => {
            const lineErrors = errors.lines?.[index];
            return (
              <div
                key={field.id}
                className="grid grid-cols-1 items-end gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr_auto]"
              >
                <FormField
                  label="Account"
                  htmlFor={`lines.${index}.account_id`}
                  required
                  error={lineErrors?.account_id?.message}
                >
                  <Select
                    id={`lines.${index}.account_id`}
                    invalid={!!lineErrors?.account_id}
                    disabled={!accounts}
                    {...register(`lines.${index}.account_id`)}
                  >
                    <option value="">{accounts ? "Select an account" : "Loading accounts…"}</option>
                    {accounts?.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_number} — {account.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Description" htmlFor={`lines.${index}.line_memo`}>
                  <Input id={`lines.${index}.line_memo`} {...register(`lines.${index}.line_memo`)} />
                </FormField>
                <FormField label="Debit" htmlFor={`lines.${index}.debit`} error={lineErrors?.debit?.message}>
                  <Input
                    id={`lines.${index}.debit`}
                    type="number"
                    min={0}
                    step="0.01"
                    invalid={!!lineErrors?.debit}
                    {...register(`lines.${index}.debit`)}
                  />
                </FormField>
                <FormField label="Credit" htmlFor={`lines.${index}.credit`}>
                  <Input id={`lines.${index}.credit`} type="number" min={0} step="0.01" {...register(`lines.${index}.credit`)} />
                </FormField>
                <Button type="button" variant="ghost" onClick={() => remove(index)} disabled={fields.length <= 2}>
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
        <div className="flex gap-6 text-sm text-text">
          <span>
            Total Debit: <strong>{formatMoney(totalDebitMinor, "USD")}</strong>
          </span>
          <span>
            Total Credit: <strong>{formatMoney(totalCreditMinor, "USD")}</strong>
          </span>
        </div>
        <Badge tone={isBalanced ? "accent" : "danger"}>{isBalanced ? "Balanced" : "Not balanced"}</Badge>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting || !isBalanced}>
          {isSubmitting ? "Recording…" : "Record Manual Adjustment"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/finance/journal")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
