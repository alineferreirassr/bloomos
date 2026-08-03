import { ManualAdjustmentForm } from "@/modules/finance/components/ManualAdjustmentForm";

export function NewManualAdjustmentView() {
  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">Record Manual Adjustment</h2>
      <p className="mt-1 text-sm text-text-muted">
        Directly authors a balanced Journal Entry against real Chart of Accounts accounts.
      </p>
      <div className="mt-6 max-w-4xl">
        <ManualAdjustmentForm />
      </div>
    </div>
  );
}
