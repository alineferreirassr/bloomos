import type { ClientStatus } from "@/core/enums/clientStatus";
import type { LeadStatus } from "@/core/enums/leadStatus";
import type { EventStatus } from "@/core/enums/eventStatus";
import type { EventLifecycleStage } from "@/core/enums/eventLifecycleStage";
import type { SignatureStatus } from "@/core/enums/signatureStatus";
import type { InvoiceStatus } from "@/core/enums/invoiceStatus";
import type { ProposalStatus } from "@/types/proposal";
import type { AIMemoryEntry } from "@/types/aiMemory";

export interface CrmAssistantClientSummary {
  clientId: string;
  name: string;
  status: ClientStatus;
  isVip: boolean;
  isReturning: boolean;
  tags: string[];
  createdAt: string;
}

export interface CrmAssistantLeadSummary {
  leadId: string;
  name: string;
  status: LeadStatus;
  source: string;
  eventType: string | null;
  eventDate: string | null;
  createdAt: string;
}

export interface CrmAssistantEventSummary {
  eventId: string;
  title: string;
  eventDate: string | null;
  clientId: string;
  status: EventStatus;
  lifecycleStage: EventLifecycleStage;
}

export interface CrmAssistantContractSummary {
  contractId: string;
  contractNumber: string;
  clientId: string;
  eventId: string | null;
  signatureStatus: SignatureStatus;
  effectiveDate: string | null;
}

export interface CrmAssistantInvoiceSummary {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  eventId: string | null;
  status: InvoiceStatus;
  balanceMinor: number;
  currency: string;
  dueDate: string | null;
}

export interface CrmAssistantProposalSummary {
  proposalId: string;
  eventId: string;
  clientId: string;
  status: ProposalStatus;
  version: number;
  generatedAt: string;
}

/** Metadata only, per the AI platform's standing rule — never the Daily Brief's own narrative content, matching `DailyBriefExecution`'s own doc comment. */
export interface CrmAssistantDailyBriefSummary {
  executionId: string;
  status: "success" | "failure";
  generatedAt: string;
}

/** A safe projection of `AuditLogEntry` — action/ownerType/occurredAt only, never `before`/`after` (raw field diffs that could carry any entity's data, including the sensitive Client fields this feature must never expose). Same shape `DailyBriefActivityEntry` already established. */
export interface CrmAssistantActivityEntry {
  action: string;
  ownerType: string;
  occurredAt: string;
}

/**
 * BloomOS has no dedicated communication log yet (`ClientExtensionSummary.communicationHistory`
 * is a hardcoded-empty stub — confirmed via audit). This is a deterministic
 * aggregate over the same Timeline Activity entries already fetched for
 * `recentActivity`, filtered to communication-adjacent types
 * (`welcome_guide_sent`, `note_added`, `communication_preference_changed`) —
 * never a fabricated or invented data source, never raw Note content.
 */
export interface CrmCommunicationSummary {
  totalLoggedTouchpoints: number;
  mostRecentTouchpointAt: string | null;
}

/** A Client whose current data crosses a deterministic risk threshold — reasons are computed facts, never a model's own claim. */
export interface CrmAssistantClientRisk {
  clientId: string;
  name: string;
  reasons: string[];
}

export const CRM_ASSISTANT_DATA_CATEGORIES = ["clients", "leads", "events", "contracts", "finance", "proposals", "dailyBriefs", "activity"] as const;
export type CrmAssistantDataCategory = (typeof CRM_ASSISTANT_DATA_CATEGORIES)[number];

/**
 * The CRM Context Builder's own output (Checkpoint 7, Step 2) — deliberately
 * does NOT hold every raw Client/Lead record (that would be both an
 * unbounded prompt payload and, for Clients specifically, a path for
 * sensitive internal fields to leak into a model prompt). Instead it holds
 * the already-classified, deterministic subsets (`priorityClients`,
 * `inactiveClients`, `clientsAtRisk`) — the same "compute the facts in
 * code, only pass the model what it needs to narrate" principle every
 * other Bloom AI Skill already follows. `recentMemories` is populated by
 * `registerCRMAssistantUseCase.ts`'s own `composeContext`, not here — it
 * arrives through the optional `"memory"` Context Orchestrator section,
 * never a direct fetch this builder performs itself.
 */
export interface CrmAssistantContext {
  generatedAt: string;

  totalClientCount: number;
  totalLeadCount: number;
  priorityClients: CrmAssistantClientSummary[];
  inactiveClients: CrmAssistantClientSummary[];
  clientsAtRisk: CrmAssistantClientRisk[];
  /** Leads not yet lost/converted/archived — the pool "Upcoming Opportunities" narrates against, newest first, bounded. */
  activeLeads: CrmAssistantLeadSummary[];

  upcomingEvents: CrmAssistantEventSummary[];
  pastEvents: CrmAssistantEventSummary[];

  unsignedContracts: CrmAssistantContractSummary[];
  outstandingInvoices: CrmAssistantInvoiceSummary[];
  outstandingBalanceMinor: number;
  outstandingCurrency: string;

  proposalHistory: CrmAssistantProposalSummary[];

  recentDailyBriefs: CrmAssistantDailyBriefSummary[];
  recentActivity: CrmAssistantActivityEntry[];
  communicationSummary: CrmCommunicationSummary;

  recentMemories: AIMemoryEntry[];

  unavailableCategories: CrmAssistantDataCategory[];
}

export const CRM_ACTION_TARGET_TYPES = ["client", "lead", "event", "contract", "invoice"] as const;
export type CrmActionTargetType = (typeof CRM_ACTION_TARGET_TYPES)[number];

export interface CrmAssistantActionTarget {
  type: CrmActionTargetType;
  href: string;
  label: string;
}

export interface CrmAssistantModelAction {
  label: string;
  reason: string;
  targetType: CrmActionTargetType | null;
  targetId: string | null;
}

export interface CrmAssistantResolvedAction {
  label: string;
  reason: string;
  actionTarget: CrmAssistantActionTarget | null;
}

/**
 * The narrative-only shape the AI Runtime actually parses from the model —
 * everything else in `CrmAssistantBrief` is computed deterministically in
 * `assembleBrief.ts` from `CrmAssistantContext` and never touched by the
 * model. Mirrors `DailyOperationsBriefModelOutput`'s own split.
 */
export interface CRMAssistantModelOutput {
  executiveSummary: string;
  relationshipHealthSummary: string;
  clientRiskExplanations: { clientId: string; explanation: string }[];
  upcomingOpportunities: CrmAssistantModelAction[];
  suggestedFollowUps: CrmAssistantModelAction[];
  recommendedActions: CrmAssistantModelAction[];
}

export interface CrmAssistantRelationshipHealth {
  summary: string;
  totalClients: number;
  totalLeads: number;
  priorityClientCount: number;
  inactiveClientCount: number;
  atRiskClientCount: number;
}

export interface CrmAssistantResolvedClientRisk {
  client: CrmAssistantClientRisk;
  explanation: string | null;
}

/** The full, UI-ready CRM Assistant report — every section named in Checkpoint 7, Step 4. */
export interface CrmAssistantBrief {
  executiveSummary: string;
  relationshipHealth: CrmAssistantRelationshipHealth;
  priorityClients: CrmAssistantClientSummary[];
  inactiveClients: CrmAssistantClientSummary[];
  clientsAtRisk: CrmAssistantResolvedClientRisk[];
  unsignedContracts: CrmAssistantContractSummary[];
  outstandingPayments: CrmAssistantInvoiceSummary[];
  outstandingBalanceMinor: number;
  outstandingCurrency: string;
  upcomingOpportunities: CrmAssistantResolvedAction[];
  suggestedFollowUps: CrmAssistantResolvedAction[];
  recommendedActions: CrmAssistantResolvedAction[];
  confidence: number;
  missingInformation: string[];
  /** The same approved-only memories threaded into the model's own prompt (Step 6) — surfaced here too so the UI's "Recent AI Recommendations" section never has to re-fetch them. */
  relevantMemories: AIMemoryEntry[];
}

export interface GeneratedCrmAssistantBrief {
  context: CrmAssistantContext;
  brief: CrmAssistantBrief;
  mock: boolean;
  model: string;
  provider: string;
  promptVersion: string;
  contextVersion: string;
  generatedAt: string;
}

export type GenerateCRMAssistantBriefResult = { success: true; data: GeneratedCrmAssistantBrief } | { success: false; error: string };
