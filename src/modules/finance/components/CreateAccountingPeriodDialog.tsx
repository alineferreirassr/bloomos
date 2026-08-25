"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createAccountingPeriod } from "@/lib/data";
import { accountingPeriodCreateInputSchema, type AccountingPeriodFormInput } from "@/modules/finance/schema";
import type { AccountingPeriod } from "@/types/accountingPeriod";

interface CreateAccountingPeriodDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new AccountingPeriod on success, or with no argument on an unexpected thrown failure (see submit's catch) — the real caller today only uses this to trigger a refetch, so the argument is safely optional. */
  onCreated: (period?: AccountingPeriod) => void;
}

/**
 * No "name" field exists on AccountingPeriod (accounting_periods has no
 * such column — see docs/finance-ledger.md) — a period is identified by
 * its date range everywhere else in this UI, so this form only collects
 * start/end. Overlap and invalid-range errors are surfaced verbatim from
 * create_accounting_period's own P1116 check, not re-derived here.
 */
export function CreateAccountingPeriodDialog({ open, onClose, onCreated }: CreateAccountingPeriodDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountingPeriodFormInput>({
    resolver: zodResolver(accountingPeriodCreateInputSchema),
    defaultValues: { period_start: "", period_end: "" },
  });

  const handleClose = () => {
    if (isSubmitting) return;
    setFormError(null);
    reset();
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await createAccountingPeriod(values);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      reset();
      onCreated(result.data);
      onClose();
    } catch {
      // A genuinely unexpected failure (network/auth/out-of-taxonomy RPC
      // error) throws rather than resolving a DataResult — same contract
      // every Finance mutation shares (see ReverseDepositApplicationModal's
      // identical fix). React Hook Form already resets formState.isSubmitting
      // on a thrown submit callback, so no local submitting state is needed
      // here. Deliberately does NOT call onClose() or reset(): the period
      // may or may not have actually been created, so the safest response
      // keeps the dialog open with the entered values intact while
      // reconciling the parent list via onCreated() — a retry safely
      // rejects as an overlapping range if the create already landed.
      setFormError("Something went wrong. Please try again.");
      onCreated();
    }
  });

  return (
    <Modal open={open} onClose={handleClose} title="Create Accounting Period">
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <p role="alert" className="text-xs text-danger">
            {formError}
          </p>
        ) : null}
        <FormField label="Start date" htmlFor="period_start" required error={errors.period_start?.message}>
          <Input id="period_start" type="date" invalid={!!errors.period_start} {...register("period_start")} />
        </FormField>
        <FormField label="End date" htmlFor="period_end" required error={errors.period_end?.message}>
          <Input id="period_end" type="date" invalid={!!errors.period_end} {...register("period_end")} />
        </FormField>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create Period"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
