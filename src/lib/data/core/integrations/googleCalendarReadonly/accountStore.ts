import { generateId, nowIso } from "@/lib/data/utils";
import { selectRepository } from "@/lib/data/provider";
import * as supabaseAccountStore from "@/lib/data/core/integrations/googleCalendarReadonly/supabaseAccountStore";
import type { GoogleCalendarAccount } from "@/core/integrations/googleCalendarReadonly/types";

/** GCAL-02 — the Google Calendar (read-only) account store, mirroring `gmail/mailboxStore.ts`'s exact shape. No ownership validation here — `googleCalendarAccountManager.ts`'s job. */
let accounts: GoogleCalendarAccount[] = [];

export function resetGoogleCalendarAccountStore(): void {
  accounts = [];
}

export function generateGoogleCalendarAccountId(): string {
  return generateId("google-calendar-account");
}

async function mockInsertAccount(account: GoogleCalendarAccount): Promise<GoogleCalendarAccount> {
  accounts = [...accounts, account];
  return account;
}

async function mockGetAccountById(id: string): Promise<GoogleCalendarAccount | null> {
  return accounts.find((account) => account.id === id) ?? null;
}

async function mockGetAccountByConnectionId(integrationConnectionId: string): Promise<GoogleCalendarAccount | null> {
  return accounts.find((account) => account.integration_connection_id === integrationConnectionId) ?? null;
}

async function mockListAccountsForWorkspace(workspaceId: string): Promise<GoogleCalendarAccount[]> {
  return accounts.filter((account) => account.workspace_id === workspaceId);
}

async function mockUpdateAccount(id: string, patch: Partial<GoogleCalendarAccount>): Promise<GoogleCalendarAccount | null> {
  const existing = await mockGetAccountById(id);
  if (!existing) return null;
  const updated: GoogleCalendarAccount = { ...existing, ...patch, updated_at: nowIso() };
  accounts = accounts.map((account) => (account.id === id ? updated : account));
  return updated;
}

export function insertAccount(account: GoogleCalendarAccount): Promise<GoogleCalendarAccount> {
  return selectRepository({ mock: mockInsertAccount, supabase: supabaseAccountStore.insertAccount })(account);
}

export function getAccountById(id: string): Promise<GoogleCalendarAccount | null> {
  return selectRepository({ mock: mockGetAccountById, supabase: supabaseAccountStore.getAccountById })(id);
}

export function getAccountByConnectionId(integrationConnectionId: string): Promise<GoogleCalendarAccount | null> {
  return selectRepository({ mock: mockGetAccountByConnectionId, supabase: supabaseAccountStore.getAccountByConnectionId })(integrationConnectionId);
}

export function listAccountsForWorkspace(workspaceId: string): Promise<GoogleCalendarAccount[]> {
  return selectRepository({ mock: mockListAccountsForWorkspace, supabase: supabaseAccountStore.listAccountsForWorkspace })(workspaceId);
}

export function updateAccount(id: string, patch: Partial<GoogleCalendarAccount>): Promise<GoogleCalendarAccount | null> {
  return selectRepository({ mock: mockUpdateAccount, supabase: supabaseAccountStore.updateAccount })(id, patch);
}
