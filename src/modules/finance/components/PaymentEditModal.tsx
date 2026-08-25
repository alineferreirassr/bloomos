"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { updatePayment } from "@/lib/data";
import type { Payment } from "@/types/payment";
import { paymentFormSchema, paymentFormToInput, type PaymentFormInput } from "@/modules/finance/schema";
import { paymentToFormInput } from "@/modules/finance/mappers";
import { PAYMENT_TYPE_LABELS, PAYMENT_TYPES } from "@/core/enums/paymentType";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/core/enums/paymentMethod";

interface PaymentEditModalProps {
  payment: Payment;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Only the fields updatePayment() actually accepts changes to are rendered
 * here — client_id and invoice_id are carried over unchanged from the
 * existing Payment (the data layer rejects a change to either), the same
 * "disable what the server would reject" precedent as EditContractView's
 * disableClientChange.
 */
export function PaymentEditModal({ payment, open, onClose, onSaved }: PaymentEditModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: paymentToFormInput(payment),
  });

  const handleClose = () => {
    setFormError(null);
    reset(paymentToFormInput(payment));
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await updatePayment(payment.id, paymentFormToInput(values));
      if (!result.success) {
        setFormError(result.error);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            setError(field as keyof PaymentFormInput, { message });
          }
        }
        return;
      }
      onSaved();
    } catch {
      // A genuinely unexpected failure (network/auth/out-of-taxonomy RPC
      // error) throws rather than resolving a DataResult — same contract
      // every Finance mutation shares (see ReverseDepositApplicationModal's
      // identical fix). React Hook Form already resets formState.isSubmitting
      // on a thrown submit callback, so no local submitting state is needed
      // here — without this catch, the Founder would simply see no feedback
      // at all. Deliberately does NOT call onSaved(): that callback also
      // closes the modal, and the update may or may not have actually
      // committed, so the safest response is to surface the fallback and
      // let the Founder retry or close explicitly.
      setFormError("Something went wrong. Please try again.");
    }
  });

  return (
    <Modal open={open} onClose={handleClose} title="Edit Payment">
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Payment type" htmlFor="edit_payment_type" required error={errors.payment_type?.message}>
            <Select id="edit_payment_type" invalid={!!errors.payment_type} {...register("payment_type")}>
              {PAYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PAYMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Payment method" htmlFor="edit_payment_method" required error={errors.payment_method?.message}>
            <Select id="edit_payment_method" invalid={!!errors.payment_method} {...register("payment_method")}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Amount" htmlFor="edit_amount" required error={errors.amount?.message}>
            <Input id="edit_amount" type="number" min={0} step="0.01" invalid={!!errors.amount} {...register("amount")} />
          </FormField>
          <FormField label="Currency" htmlFor="edit_currency" required error={errors.currency?.message}>
            <Input id="edit_currency" maxLength={3} invalid={!!errors.currency} {...register("currency")} />
          </FormField>
          <FormField
            label="Transaction date"
            htmlFor="edit_transaction_date"
            required
            error={errors.transaction_date?.message}
          >
            <Input id="edit_transaction_date" type="date" invalid={!!errors.transaction_date} {...register("transaction_date")} />
          </FormField>
          <FormField label="Reference" htmlFor="edit_reference" error={errors.reference?.message}>
            <Input id="edit_reference" invalid={!!errors.reference} {...register("reference")} />
          </FormField>
        </div>

        <FormField label="Notes" htmlFor="edit_notes" error={errors.notes?.message}>
          <Textarea id="edit_notes" rows={3} invalid={!!errors.notes} {...register("notes")} />
        </FormField>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
