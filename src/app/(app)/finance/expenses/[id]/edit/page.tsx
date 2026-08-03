import { EditExpenseView } from "@/modules/finance/components/EditExpenseView";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditExpenseView key={id} expenseId={id} />;
}
