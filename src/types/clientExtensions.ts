/**
 * Client's cross-module extension points — Proposal History (Leads), Event
 * History (Events), Payment Summary (Finance), Document Summary
 * (Documents), Communication History, and AI Profile Summary (Bloom AI /
 * Core AI). None of these are stored on `Client` itself: every one of them
 * is inherently a DERIVED view of another module's data, so storing a
 * snapshot on the Client row would go stale the moment the source data
 * changes, and there is nothing to compute it FROM yet since Leads/Events/
 * Finance/Documents/Bloom AI integration is explicitly not implemented this
 * phase. This file exists so Client "integrates naturally" with those
 * modules in shape, not in behavior — see
 * `lib/data/clients/extensions.ts`'s stub implementation, which returns an
 * empty summary today and is the only place that changes once a real
 * integration is wired in.
 */

export interface ClientProposalHistoryEntry {
  leadId: string;
  sentAt: string;
  status: string;
}

export interface ClientEventHistorySummary {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  lastEventDate: string | null;
}

export interface ClientPaymentSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  lastPaymentDate: string | null;
}

export interface ClientDocumentSummary {
  totalDocuments: number;
  lastDocumentDate: string | null;
}

export interface ClientCommunicationHistoryEntry {
  channel: string;
  occurredAt: string;
  summary: string;
}

export interface ClientAIProfileSummary {
  summary: string;
  generatedAt: string;
  model: string;
}

export interface ClientExtensionSummary {
  proposalHistory: ClientProposalHistoryEntry[];
  eventHistory: ClientEventHistorySummary | null;
  paymentSummary: ClientPaymentSummary | null;
  documentSummary: ClientDocumentSummary | null;
  communicationHistory: ClientCommunicationHistoryEntry[];
  aiProfileSummary: ClientAIProfileSummary | null;
}
