import { ClientPortalProposalDetailView } from "@/modules/clientPortal/components/ClientPortalProposalDetailView";

export default async function ClientPortalProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientPortalProposalDetailView proposalId={id} />;
}
