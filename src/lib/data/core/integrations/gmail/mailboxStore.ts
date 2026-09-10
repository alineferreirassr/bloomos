import { generateId, nowIso } from "@/lib/data/utils";
import { selectRepository } from "@/lib/data/provider";
import * as supabaseMailboxStore from "@/lib/data/core/integrations/gmail/supabaseMailboxStore";
import type { GmailMailbox } from "@/core/integrations/gmail/types";

/**
 * GMAIL-04 — the Gmail Mailbox store, mirroring `connectionStore.ts`'s
 * exact mock/Supabase split via `selectRepository()`. Pure data access —
 * no ownership validation, no connection-binding checks, no Gmail API
 * calls. Ownership/binding is `gmailMailboxManager.ts`'s job, the same
 * "store never enforces ownership, the manager above it does" split
 * `integrationManager.ts`/`connectionStore.ts` already established.
 */
let mailboxes: GmailMailbox[] = [];

export function resetGmailMailboxStore(): void {
  mailboxes = [];
}

export function generateGmailMailboxId(): string {
  return generateId("gmail-mailbox");
}

async function mockInsertMailbox(mailbox: GmailMailbox): Promise<GmailMailbox> {
  mailboxes = [...mailboxes, mailbox];
  return mailbox;
}

async function mockGetMailboxById(id: string): Promise<GmailMailbox | null> {
  return mailboxes.find((mailbox) => mailbox.id === id) ?? null;
}

async function mockGetMailboxByConnectionId(connectionId: string): Promise<GmailMailbox | null> {
  return mailboxes.find((mailbox) => mailbox.integration_connection_id === connectionId) ?? null;
}

async function mockListMailboxesForWorkspace(workspaceId: string): Promise<GmailMailbox[]> {
  return mailboxes.filter((mailbox) => mailbox.workspace_id === workspaceId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function mockUpdateMailbox(id: string, patch: Partial<GmailMailbox>): Promise<GmailMailbox | null> {
  const existing = await mockGetMailboxById(id);
  if (!existing) return null;
  const updated: GmailMailbox = { ...existing, ...patch, updated_at: nowIso() };
  mailboxes = mailboxes.map((mailbox) => (mailbox.id === id ? updated : mailbox));
  return updated;
}

export function insertMailbox(mailbox: GmailMailbox): Promise<GmailMailbox> {
  return selectRepository({ mock: mockInsertMailbox, supabase: supabaseMailboxStore.insertMailbox })(mailbox);
}

export function getMailboxById(id: string): Promise<GmailMailbox | null> {
  return selectRepository({ mock: mockGetMailboxById, supabase: supabaseMailboxStore.getMailboxById })(id);
}

export function getMailboxByConnectionId(connectionId: string): Promise<GmailMailbox | null> {
  return selectRepository({ mock: mockGetMailboxByConnectionId, supabase: supabaseMailboxStore.getMailboxByConnectionId })(connectionId);
}

export function listMailboxesForWorkspace(workspaceId: string): Promise<GmailMailbox[]> {
  return selectRepository({ mock: mockListMailboxesForWorkspace, supabase: supabaseMailboxStore.listMailboxesForWorkspace })(workspaceId);
}

export function updateMailbox(id: string, patch: Partial<GmailMailbox>): Promise<GmailMailbox | null> {
  return selectRepository({ mock: mockUpdateMailbox, supabase: supabaseMailboxStore.updateMailbox })(id, patch);
}
