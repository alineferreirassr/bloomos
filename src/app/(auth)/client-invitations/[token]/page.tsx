import { ClientInvitationAcceptanceView } from "./ClientInvitationAcceptanceView";

export default async function ClientInvitationAcceptancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ClientInvitationAcceptanceView token={token} />;
}
