import type { Lead } from "@/types/lead";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { LeadStatus } from "@/core/enums/leadStatus";
import type { LeadFormInput } from "@/modules/leads/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { DataResult } from "@/lib/data/result";

export interface LeadFilters {
  search?: string;
  status?: LeadStatus | "all";
  source?: string | "all";
  eventType?: string | "all";
  includeArchived?: boolean;
}

/**
 * The single Leads persistence contract — implemented once by the mock
 * repository (lib/data/leads/mockRepository.ts) and once by the Supabase
 * repository (lib/data/leads/supabaseRepository.ts). lib/data/index.ts picks
 * between them via lib/data/provider.ts's selectRepository(); nothing outside
 * this file, the two implementations, and that one selection point is ever
 * allowed to know which backend is active.
 *
 * Deliberately identical in shape to the pre-migration mock functions in
 * lib/data/index.ts — no restoreLead/deleteLead (the mock's "archived"
 * status is terminal, matching "converted", with no restore path) and no
 * sort/pagination parameters (the mock never had them either). Widening this
 * interface is a feature-expansion decision for a future phase, not part of
 * a persistence migration.
 */
export interface LeadsRepository {
  getLeads(filters?: LeadFilters): Promise<Lead[]>;
  getLeadById(id: string): Promise<Lead>;
  createLead(input: LeadFormInput): Promise<DataResult<Lead>>;
  updateLead(id: string, input: LeadFormInput): Promise<DataResult<Lead>>;
  updateLeadStatus(id: string, status: LeadStatus): Promise<DataResult<Lead>>;
  archiveLead(id: string): Promise<DataResult<Lead>>;
  markWelcomeGuideSent(id: string): Promise<DataResult<Lead>>;
  getNotesByLeadId(leadId: string): Promise<Note[]>;
  createNote(leadId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  getTimelineByLeadId(leadId: string): Promise<TimelineActivity[]>;
}
