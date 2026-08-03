import { ProposalDetailView } from "@/modules/proposalPlatform/components/ProposalDetailView";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProposalDetailView proposalId={id} />;
}
