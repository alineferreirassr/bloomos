import type { ClientPortalMessage, ClientPortalMessageThread } from "@/types/clientPortalMessage";
import { getClientPortalMessageThread, listClientPortalMessages, sendClientPortalMessage, markClientPortalThreadRead } from "@/lib/data/clientPortal/clientPortalMessageStore";
import { mockClientAccessRepository } from "@/lib/data/clientAccess/mockRepository";
import { NotFoundError } from "@/core/errors";
import { type DataResult, ok, fail } from "@/lib/data/result";

/** Resolves the current client account the same mock-only way every other brand-new Checkpoint 14 domain does (see `clientPortalMessageStore.ts`'s own doc comment for why). */
async function currentAccount() {
  const account = await mockClientAccessRepository.getCurrentClientAccount();
  if (!account) throw new NotFoundError("No active client account.");
  return account;
}

export async function getClientPortalThread(): Promise<ClientPortalMessageThread> {
  const account = await currentAccount();
  return getClientPortalMessageThread(account.workspace_id, account.id);
}

export async function getClientPortalMessages(): Promise<ClientPortalMessage[]> {
  const thread = await getClientPortalThread();
  return listClientPortalMessages(thread.id);
}

export async function sendClientPortalMessageAsClient(body: string): Promise<DataResult<ClientPortalMessage>> {
  const trimmed = body.trim();
  if (trimmed.length === 0) return fail("Please fix the highlighted fields.", { body: "A message can't be empty" });
  const thread = await getClientPortalThread();
  return ok(sendClientPortalMessage(thread.id, "client", null, trimmed));
}

export async function markClientPortalThreadReadForCurrentSession(): Promise<void> {
  const thread = await getClientPortalThread();
  markClientPortalThreadRead(thread.id);
}
