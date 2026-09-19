import { PageHeader } from "@/components/ui/PageHeader";
import { ManualAdjustmentForm } from "@/modules/finance/components/ManualAdjustmentForm";

export function NewManualAdjustmentView() {
  return (
    // GLOBAL-VISUAL-06 (Business) — same AF-ported detail/form pattern as
    // NewExpenseView/NewInvoiceView.
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Finance"
        title="Record Manual Adjustment"
        subtitle="Directly authors a balanced Journal Entry against real Chart of Accounts accounts."
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Finance", href: "/finance" }, { label: "Journal Entries", href: "/finance/journal" }, { label: "New Adjustment" }]}
      />
      <div className="mt-6 max-w-4xl">
        <ManualAdjustmentForm />
      </div>
    </div>
  );
}
