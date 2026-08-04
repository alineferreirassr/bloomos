import type { Contract, ContractVersionSnapshot } from "@/types/contract";
import type { ContractTemplate } from "@/types/contractTemplate";
import type { ContractExhibit } from "@/types/contractExhibit";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { ContractStatus } from "@/core/enums/contractStatus";
import type { SignatureStatus } from "@/core/enums/signatureStatus";
import type { ContractTemplateCategory } from "@/core/enums/contractTemplateCategory";
import type { ContractInput } from "@/modules/contracts/schema";
import type { ContractExhibitInput } from "@/modules/contracts/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { DataResult } from "@/lib/data/result";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";

export type { ContractVersionSnapshot };

export interface ContractFilters {
  search?: string;
  status?: ContractStatus | "all";
  signatureStatus?: SignatureStatus | "all";
  clientId?: string;
  eventId?: string;
  /** Inclusive; contracts with no effective_date never match when either bound is set. */
  effectiveDateFrom?: string;
  effectiveDateTo?: string;
  includeArchived?: boolean;
}

export interface ContractTemplateFilters {
  category?: ContractTemplateCategory | "all";
  activeOnly?: boolean;
}

/**
 * The single Contracts persistence contract — implemented once by the mock
 * repository (lib/data/contracts/mockRepository.ts) and once by the
 * Supabase repository (lib/data/contracts/supabaseRepository.ts), exactly
 * mirroring the Leads/Clients/Events repository pattern. lib/data/index.ts
 * picks between them via lib/data/provider.ts's selectRepository().
 *
 * Bundles Contracts, Contract Templates, Contract Exhibits, and Contract
 * Notes/Timeline together — same rationale as EventsRepository: every
 * Exhibit/Note/Timeline operation needs the owning Contract's workspace_id
 * first, and Templates are read here too since a Contract's template_id
 * lookup and validation live in the same file regardless of read-only
 * status.
 */
export interface ContractsRepository {
  /** `context` optionally injects an already-authenticated server Supabase client + Workspace session — see EventsRepository's identical doc comment. Ignored by the mock implementation. */
  getContracts(filters?: ContractFilters, context?: ServerRepositoryContext): Promise<Contract[]>;
  getContract(id: string): Promise<Contract>;
  createContract(input: ContractInput): Promise<DataResult<Contract>>;
  updateContract(id: string, input: ContractInput): Promise<DataResult<Contract>>;
  updateContractStatus(id: string, status: ContractStatus): Promise<DataResult<Contract>>;
  sendContract(id: string): Promise<DataResult<Contract>>;
  markViewed(id: string): Promise<DataResult<Contract>>;
  markSigned(id: string): Promise<DataResult<Contract>>;
  markDeclined(id: string): Promise<DataResult<Contract>>;
  expireContract(id: string): Promise<DataResult<Contract>>;
  cancelContract(id: string): Promise<DataResult<Contract>>;
  completeContract(id: string): Promise<DataResult<Contract>>;
  archiveContract(id: string): Promise<DataResult<Contract>>;
  restoreContract(id: string): Promise<DataResult<Contract>>;
  duplicateContract(id: string): Promise<DataResult<Contract>>;
  getContractNextAction(contractId: string): Promise<string | null>;

  getContractTemplates(filters?: ContractTemplateFilters): Promise<ContractTemplate[]>;
  getContractTemplateById(id: string): Promise<ContractTemplate>;

  getContractExhibitsByContractId(contractId: string): Promise<ContractExhibit[]>;
  /** Direct lookup by id, independent of its parent Contract — needed by callers (e.g. Documents) that only have an exhibit id on hand. */
  getContractExhibitById(id: string): Promise<ContractExhibit>;
  createContractExhibit(contractId: string, input: ContractExhibitInput): Promise<DataResult<ContractExhibit>>;
  updateContractExhibit(id: string, input: ContractExhibitInput): Promise<DataResult<ContractExhibit>>;
  deleteContractExhibit(id: string): Promise<DataResult<null>>;
  reorderContractExhibits(contractId: string, orderedIds: string[]): Promise<DataResult<ContractExhibit[]>>;

  getNotesByContractId(contractId: string): Promise<Note[]>;
  createContractNote(contractId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  /**
   * Same null-fallthrough contract as togglePinNote/togglePinClientNote/
   * togglePinEventNote — null means "not a Contract-owned note," letting the
   * shared lib/data/index.ts togglePinNote() try Leads, then Clients, then
   * Events, then Contracts, before falling through to the generic
   * mock-only path for every other not-yet-migrated owner type.
   */
  togglePinContractNote(noteId: string): Promise<DataResult<Note> | null>;
  getTimelineByContractId(contractId: string): Promise<TimelineActivity[]>;
}
