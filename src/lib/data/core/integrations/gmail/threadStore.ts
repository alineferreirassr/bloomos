import { generateId, nowIso } from "@/lib/data/utils";
import { selectRepository } from "@/lib/data/provider";
import * as supabaseThreadStore from "@/lib/data/core/integrations/gmail/supabaseThreadStore";
import type { GmailThread } from "@/core/integrations/gmail/types";

/** GMAIL-04 — the Gmail Thread store, mirroring `mailboxStore.ts`'s exact shape. No ownership validation here — `gmailMailboxManager.ts`'s job. */
let threads: GmailThread[] = [];

export function resetGmailThreadStore(): void {
  threads = [];
}

export function generateGmailThreadId(): string {
  return generateId("gmail-thread");
}

async function mockInsertThread(thread: GmailThread): Promise<GmailThread> {
  threads = [...threads, thread];
  return thread;
}

async function mockGetThreadById(id: string): Promise<GmailThread | null> {
  return threads.find((thread) => thread.id === id) ?? null;
}

async function mockGetThreadByProviderId(mailboxId: string, providerThreadId: string): Promise<GmailThread | null> {
  return threads.find((thread) => thread.mailbox_id === mailboxId && thread.provider_thread_id === providerThreadId) ?? null;
}

async function mockListThreadsForMailbox(mailboxId: string): Promise<GmailThread[]> {
  return threads
    .filter((thread) => thread.mailbox_id === mailboxId)
    .sort((a, b) => (b.latest_message_at ?? "").localeCompare(a.latest_message_at ?? ""));
}

async function mockUpdateThread(id: string, patch: Partial<GmailThread>): Promise<GmailThread | null> {
  const existing = await mockGetThreadById(id);
  if (!existing) return null;
  const updated: GmailThread = { ...existing, ...patch, updated_at: nowIso() };
  threads = threads.map((thread) => (thread.id === id ? updated : thread));
  return updated;
}

export function insertThread(thread: GmailThread): Promise<GmailThread> {
  return selectRepository({ mock: mockInsertThread, supabase: supabaseThreadStore.insertThread })(thread);
}

export function getThreadById(id: string): Promise<GmailThread | null> {
  return selectRepository({ mock: mockGetThreadById, supabase: supabaseThreadStore.getThreadById })(id);
}

export function getThreadByProviderId(mailboxId: string, providerThreadId: string): Promise<GmailThread | null> {
  return selectRepository({ mock: mockGetThreadByProviderId, supabase: supabaseThreadStore.getThreadByProviderId })(mailboxId, providerThreadId);
}

export function listThreadsForMailbox(mailboxId: string): Promise<GmailThread[]> {
  return selectRepository({ mock: mockListThreadsForMailbox, supabase: supabaseThreadStore.listThreadsForMailbox })(mailboxId);
}

export function updateThread(id: string, patch: Partial<GmailThread>): Promise<GmailThread | null> {
  return selectRepository({ mock: mockUpdateThread, supabase: supabaseThreadStore.updateThread })(id, patch);
}
