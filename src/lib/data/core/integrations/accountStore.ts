import { generateId, nowIso } from "@/lib/data/utils";
import type { IntegrationAccount } from "@/core/integrations/types";

/** v2 Checkpoint 43. Mock-only, same precedent as `credentialStore.ts`. */
let accounts: IntegrationAccount[] = [];

export function resetAccountStore(): void {
  accounts = [];
}

export function insertAccount(account: IntegrationAccount): IntegrationAccount {
  accounts = [...accounts, account];
  return account;
}

export function getAccountByConnectionId(connectionId: string): IntegrationAccount | null {
  return accounts.find((account) => account.connection_id === connectionId) ?? null;
}

export function listAccountsForWorkspace(workspaceId: string): IntegrationAccount[] {
  return accounts.filter((account) => account.workspace_id === workspaceId).sort((a, b) => b.connected_at.localeCompare(a.connected_at));
}

export function deleteAccountByConnectionId(connectionId: string): boolean {
  const before = accounts.length;
  accounts = accounts.filter((account) => account.connection_id !== connectionId);
  return accounts.length < before;
}

export function generateAccountId(): string {
  return generateId("integration-account");
}

export { nowIso as accountNowIso };
