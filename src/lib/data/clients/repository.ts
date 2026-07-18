import type { Client } from "@/types/client";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { ClientStatus } from "@/core/enums/clientStatus";
import type { ContactMethod } from "@/core/enums/contactMethod";
import type { ClientFormInput } from "@/modules/clients/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { DataResult } from "@/lib/data/result";

export interface MarkClientRecoveryPendingInput {
  workflow: string;
  reason: string;
  payload: Record<string, unknown>;
}

export interface ClientFilters {
  search?: string;
  status?: ClientStatus | "all";
  source?: string | "all";
  tags?: string[];
  vipOnly?: boolean;
  includeArchived?: boolean;
}

/**
 * The single Clients persistence contract — implemented once by the mock
 * repository (lib/data/clients/mockRepository.ts) and once by the Supabase
 * repository (lib/data/clients/supabaseRepository.ts), exactly mirroring the
 * Leads repository pattern (lib/data/leads/repository.ts). lib/data/index.ts
 * picks between them via lib/data/provider.ts's selectRepository().
 *
 * Deliberately identical in shape to the pre-migration mock functions in
 * lib/data/index.ts — restoreClient stays (Clients, unlike Leads, support
 * un-archiving), no delete method (soft-delete only).
 */
export interface ClientsRepository {
  getClients(filters?: ClientFilters): Promise<Client[]>;
  getClientById(id: string): Promise<Client>;
  createClient(input: ClientFormInput): Promise<DataResult<Client>>;
  updateClient(id: string, input: ClientFormInput): Promise<DataResult<Client>>;
  updateClientStatus(id: string, status: ClientStatus): Promise<DataResult<Client>>;
  updateClientTags(id: string, tags: string[]): Promise<DataResult<Client>>;
  setClientVipStatus(id: string, isVip: boolean): Promise<DataResult<Client>>;
  updateClientContactPreference(id: string, method: ContactMethod | null): Promise<DataResult<Client>>;
  archiveClient(id: string): Promise<DataResult<Client>>;
  restoreClient(id: string): Promise<DataResult<Client>>;
  getClientNextAction(clientId: string): Promise<string | null>;
  getNotesByClientId(clientId: string): Promise<Note[]>;
  createClientNote(clientId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  /**
   * Toggle pin on a note, scoped to owner_type = 'client'. Returns null when
   * the note doesn't belong to this repository's backend (a Lead-owned note,
   * or simply no such note here) — the shared lib/data/index.ts
   * togglePinNote() tries leadsRepository() first, then this, then falls
   * through to the generic mock-only Notes path for every other
   * not-yet-migrated entity type. Same contract as
   * LeadsRepository.togglePinNote.
   */
  togglePinClientNote(noteId: string): Promise<DataResult<Note> | null>;
  getTimelineByClientId(clientId: string): Promise<TimelineActivity[]>;

  /**
   * Generic, workflow-agnostic recovery marker (Booking Workflow, Phase 2) —
   * see types/pendingRecovery.ts. Called whenever a multi-step operation
   * involving this Client gets stuck partway through; `workflow` identifies
   * which one (today only "booking") so future recoverable workflows reuse
   * this same mechanism instead of inventing their own column/Timeline type.
   * Increments `attempts` and preserves `first_attempt_at` if a pending
   * recovery already exists for this Client; otherwise starts a fresh one.
   */
  markClientRecoveryPending(clientId: string, input: MarkClientRecoveryPendingInput): Promise<DataResult<Client>>;
  /** Clears pending_recovery back to null and records client_recovery_resolved. */
  resolveClientRecoveryPending(clientId: string): Promise<DataResult<Client>>;
  /** Workspace-scoped; `workflow` narrows to one recoverable workflow type when provided. */
  getClientsWithPendingRecovery(workflow?: string): Promise<Client[]>;
}
