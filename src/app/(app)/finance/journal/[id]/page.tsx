import { JournalEntryDetailView } from "@/modules/finance/components/JournalEntryDetailView";

export default async function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JournalEntryDetailView key={id} journalEntryId={id} />;
}
