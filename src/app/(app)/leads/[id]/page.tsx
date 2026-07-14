import { LeadDetailView } from "@/modules/leads/components/LeadDetailView";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeadDetailView key={id} leadId={id} />;
}
