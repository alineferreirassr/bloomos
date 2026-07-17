import { InvitationAcceptanceView } from "./InvitationAcceptanceView";

export default async function InvitationAcceptancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitationAcceptanceView token={token} />;
}
