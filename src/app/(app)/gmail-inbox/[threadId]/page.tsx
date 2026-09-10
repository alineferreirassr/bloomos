import { GmailThreadView } from "@/modules/integrations/gmail/components/GmailThreadView";

export default async function GmailThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return <GmailThreadView threadId={threadId} />;
}
