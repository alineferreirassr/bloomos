import { generateId, nowIso } from "@/lib/data/utils";
import { selectRepository } from "@/lib/data/provider";
import * as supabaseMessageStore from "@/lib/data/core/integrations/gmail/supabaseMessageStore";
import type { GmailMessage } from "@/core/integrations/gmail/types";

/** GMAIL-04 — the Gmail Message store, mirroring `threadStore.ts`'s exact shape. No ownership validation here — `gmailMailboxManager.ts`'s job. */
let messages: GmailMessage[] = [];

export function resetGmailMessageStore(): void {
  messages = [];
}

export function generateGmailMessageId(): string {
  return generateId("gmail-message");
}

async function mockInsertMessage(message: GmailMessage): Promise<GmailMessage> {
  messages = [...messages, message];
  return message;
}

async function mockGetMessageById(id: string): Promise<GmailMessage | null> {
  return messages.find((message) => message.id === id) ?? null;
}

async function mockGetMessageByProviderId(mailboxId: string, providerMessageId: string): Promise<GmailMessage | null> {
  return messages.find((message) => message.mailbox_id === mailboxId && message.provider_message_id === providerMessageId) ?? null;
}

async function mockListMessagesForThread(threadId: string): Promise<GmailMessage[]> {
  return messages.filter((message) => message.thread_id === threadId).sort((a, b) => (a.internal_date ?? "").localeCompare(b.internal_date ?? ""));
}

async function mockUpdateMessage(id: string, patch: Partial<GmailMessage>): Promise<GmailMessage | null> {
  const existing = await mockGetMessageById(id);
  if (!existing) return null;
  const updated: GmailMessage = { ...existing, ...patch, updated_at: nowIso() };
  messages = messages.map((message) => (message.id === id ? updated : message));
  return updated;
}

export function insertMessage(message: GmailMessage): Promise<GmailMessage> {
  return selectRepository({ mock: mockInsertMessage, supabase: supabaseMessageStore.insertMessage })(message);
}

export function getMessageById(id: string): Promise<GmailMessage | null> {
  return selectRepository({ mock: mockGetMessageById, supabase: supabaseMessageStore.getMessageById })(id);
}

export function getMessageByProviderId(mailboxId: string, providerMessageId: string): Promise<GmailMessage | null> {
  return selectRepository({ mock: mockGetMessageByProviderId, supabase: supabaseMessageStore.getMessageByProviderId })(mailboxId, providerMessageId);
}

export function listMessagesForThread(threadId: string): Promise<GmailMessage[]> {
  return selectRepository({ mock: mockListMessagesForThread, supabase: supabaseMessageStore.listMessagesForThread })(threadId);
}

export function updateMessage(id: string, patch: Partial<GmailMessage>): Promise<GmailMessage | null> {
  return selectRepository({ mock: mockUpdateMessage, supabase: supabaseMessageStore.updateMessage })(id, patch);
}
