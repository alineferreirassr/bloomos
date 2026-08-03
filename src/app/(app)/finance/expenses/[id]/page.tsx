import { ExpenseDetailView } from "@/modules/finance/components/ExpenseDetailView";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExpenseDetailView key={id} expenseId={id} />;
}
