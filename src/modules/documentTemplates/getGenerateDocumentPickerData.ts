"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getClients, getEvents } from "@/lib/data";

const PICKER_LIMIT = 50;

export interface GenerateDocumentPickerOption {
  id: string;
  label: string;
}

export interface GenerateDocumentPickerData {
  clients: GenerateDocumentPickerOption[];
  events: GenerateDocumentPickerOption[];
}

export type GetGenerateDocumentPickerDataResult = { success: true; data: GenerateDocumentPickerData } | { success: false; error: string };

/** A short, real Client/Event picker for the "Generate Document" dialog — real records, never free-text id entry. Capped since this is a picker, not a full CRM list view. */
export async function getGenerateDocumentPickerData(): Promise<GetGenerateDocumentPickerDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: "You must be signed in." };

  const [clients, events] = await Promise.all([getClients(), getEvents()]);

  return {
    success: true,
    data: {
      clients: clients.slice(0, PICKER_LIMIT).map((client) => ({ id: client.id, label: `${client.first_name} ${client.last_name}` })),
      events: events.slice(0, PICKER_LIMIT).map((event) => ({ id: event.id, label: event.title })),
    },
  };
}
