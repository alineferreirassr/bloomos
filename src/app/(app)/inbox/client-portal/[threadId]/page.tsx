import { ClientPortalThreadView } from "@/modules/communication/inbox/components/ClientPortalThreadView";

export default async function ClientPortalThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return <ClientPortalThreadView threadId={threadId} />;
}
