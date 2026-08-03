import { ThreadConversationView } from "@/modules/communication/messaging/components/ThreadConversationView";

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return <ThreadConversationView threadId={threadId} />;
}
