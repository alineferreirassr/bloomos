import type { InvoiceStatus } from "@/core/enums/invoiceStatus";
import type { PaymentType } from "@/core/enums/paymentType";
import type { PaymentStatus } from "@/core/enums/paymentStatus";
import type { ContractStatus } from "@/core/enums/contractStatus";
import type { SignatureStatus } from "@/core/enums/signatureStatus";
import type { ProposalStatus } from "@/types/proposal";
import type { AIMemoryEntry } from "@/types/aiMemory";

export interface FinanceAssistantInvoiceSummary {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  eventId: string | null;
  status: InvoiceStatus;
  balanceMinor: number;
  totalMinor: number;
  currency: string;
  dueDate: string | null;
}

/**
 * A closed, hand-picked projection of `Payment` — deliberately excludes
 * `reference`/`payment_method`/`notes` even though `Payment`'s own doc
 * comment already confirms none of them are a true credential (no card or
 * bank numbers are ever stored anywhere in BloomOS). Per this checkpoint's
 * own "never expose sensitive payment credentials" instruction, this stays
 * conservative: nothing transaction-identifying or payment-method-specific
 * ever reaches a model prompt, only the facts a financial summary needs.
 */
export interface FinanceAssistantPaymentSummary {
  paymentId: string;
  clientId: string;
  invoiceId: string | null;
  eventId: string | null;
  paymentType: PaymentType;
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  transactionDate: string;
}

export interface FinanceAssistantContractSummary {
  contractId: string;
  contractNumber: string;
  clientId: string;
  eventId: string | null;
  status: ContractStatus;
  signatureStatus: SignatureStatus;
  totalValueMinor: number;
  currency: string;
  effectiveDate: string | null;
}

export interface FinanceAssistantProposalSummary {
  proposalId: string;
  eventId: string;
  clientId: string;
  status: ProposalStatus;
  subtotalMinor: number;
  currency: string;
  generatedAt: string;
}

export interface FinanceAssistantEventSummary {
  eventId: string;
  title: string;
  eventDate: string | null;
  clientId: string;
}

/** Metadata only, per the AI platform's standing rule — never the Daily Brief's own narrative content. */
export interface FinanceAssistantDailyBriefSummary {
  executionId: string;
  status: "success" | "failure";
  generatedAt: string;
}

/** A safe projection of `AuditLogEntry` — action/ownerType/occurredAt only, never `before`/`after`. */
export interface FinanceAssistantActivityEntry {
  action: string;
  ownerType: string;
  occurredAt: string;
}

/**
 * Checkpoint 8, Step 2's "CRM recommendations" — reuses the already-
 * registered `crmAssistantContext` Context Orchestrator section (Checkpoint
 * 7) rather than duplicating CRM Assistant's own client-risk detection.
 * Requested via `optionalContext`, so a Workspace where the CRM Assistant's
 * own context happens to be unavailable still gets a perfectly good
 * Finance report — this is purely enrichment.
 */
export interface FinanceAssistantCrmRecommendation {
  clientId: string;
  name: string;
  reasons: string[];
}

export const FINANCE_RISK_TARGET_TYPES = ["invoice", "contract"] as const;
export type FinanceRiskTargetType = (typeof FINANCE_RISK_TARGET_TYPES)[number];

/** A deterministic financial risk — reasons are computed facts, never a model's own claim. */
export interface FinanceAssistantRiskSummary {
  riskId: string;
  targetType: FinanceRiskTargetType;
  targetId: string;
  label: string;
  reasons: string[];
}

export const FINANCE_ASSISTANT_DATA_CATEGORIES = ["invoices", "payments", "contracts", "expenses", "proposals", "events", "dailyBriefs", "activity"] as const;
export type FinanceAssistantDataCategory = (typeof FINANCE_ASSISTANT_DATA_CATEGORIES)[number];

/**
 * The Finance Context Builder's own output (Checkpoint 8, Step 2). Revenue/
 * Cash Flow figures are computed by reusing `modules/finance/financialSummary.ts`'s
 * already-established, already-tested `computeWorkspaceFinancialSummary`/
 * `computeAllTimeFinancialTotals` — never reinvented here — the same
 * "one true formula, shared by the Dashboard and every AI Skill" guarantee
 * that keeps this report and `/dashboard`'s own Finance metrics from ever
 * disagreeing. `recentMemories`/`crmRecommendations` are populated by
 * `registerFinanceAssistantUseCase.ts`'s own `composeContext`, not here —
 * they arrive through the optional `"memory"`/`"crmAssistantContext"`
 * Context Orchestrator sections, never a direct fetch this builder performs.
 */
export interface FinanceAssistantContext {
  generatedAt: string;
  currency: string;

  revenueThisMonthMinor: number;
  collectedThisMonthMinor: number;
  totalInvoicedAllTimeMinor: number;
  totalCollectedAllTimeMinor: number;
  outstandingReceivablesMinor: number;
  overdueReceivablesMinor: number;
  refundsThisMonthMinor: number;
  depositsPendingMinor: number;
  expensesThisMonthMinor: number;
  netCashPositionMinor: number;

  outstandingInvoices: FinanceAssistantInvoiceSummary[];
  paymentDelays: FinanceAssistantInvoiceSummary[];
  upcomingRevenue: FinanceAssistantInvoiceSummary[];
  refunds: FinanceAssistantPaymentSummary[];

  contractValueTotalMinor: number;
  contractValueSignedMinor: number;
  contractValueUnsignedMinor: number;
  unsignedContracts: FinanceAssistantContractSummary[];

  proposalValues: FinanceAssistantProposalSummary[];
  upcomingEvents: FinanceAssistantEventSummary[];
  financialRisks: FinanceAssistantRiskSummary[];

  recentDailyBriefs: FinanceAssistantDailyBriefSummary[];
  recentActivity: FinanceAssistantActivityEntry[];
  crmRecommendations: FinanceAssistantCrmRecommendation[];
  recentMemories: AIMemoryEntry[];

  unavailableCategories: FinanceAssistantDataCategory[];
}

export const FINANCE_ACTION_TARGET_TYPES = ["invoice", "contract", "event"] as const;
export type FinanceActionTargetType = (typeof FINANCE_ACTION_TARGET_TYPES)[number];

export interface FinanceAssistantActionTarget {
  type: FinanceActionTargetType;
  href: string;
  label: string;
}

export interface FinanceAssistantModelAction {
  label: string;
  reason: string;
  targetType: FinanceActionTargetType | null;
  targetId: string | null;
}

export interface FinanceAssistantResolvedAction {
  label: string;
  reason: string;
  actionTarget: FinanceAssistantActionTarget | null;
}

/**
 * The narrative-only shape the AI Runtime actually parses from the model —
 * everything else in `FinanceAssistantBrief` is computed deterministically
 * in `assembleBrief.ts` from `FinanceAssistantContext` and never touched by
 * the model. Mirrors `CRMAssistantModelOutput`'s own split.
 */
export interface FinanceAssistantModelOutput {
  executiveSummary: string;
  revenueOverviewSummary: string;
  cashFlowSummary: string;
  financialRiskExplanations: { riskId: string; explanation: string }[];
  revenueOpportunities: FinanceAssistantModelAction[];
  recommendations: FinanceAssistantModelAction[];
}

export interface FinanceAssistantRevenueOverview {
  summary: string;
  revenueThisMonthMinor: number;
  collectedThisMonthMinor: number;
  totalInvoicedAllTimeMinor: number;
  totalCollectedAllTimeMinor: number;
  currency: string;
}

export interface FinanceAssistantCashFlowSnapshot {
  summary: string;
  collectedMinor: number;
  outstandingMinor: number;
  upcomingMinor: number;
  refundedMinor: number;
  expensesMinor: number;
  netCashPositionMinor: number;
  currency: string;
}

export interface FinanceAssistantContractValue {
  totalMinor: number;
  signedMinor: number;
  unsignedMinor: number;
  currency: string;
}

export interface FinanceAssistantResolvedRisk {
  risk: FinanceAssistantRiskSummary;
  explanation: string | null;
}

/** The full, UI-ready Finance Assistant report — every section named in Checkpoint 8, Step 4. */
export interface FinanceAssistantBrief {
  executiveSummary: string;
  revenueOverview: FinanceAssistantRevenueOverview;
  outstandingPayments: FinanceAssistantInvoiceSummary[];
  upcomingRevenue: FinanceAssistantInvoiceSummary[];
  cashFlowSnapshot: FinanceAssistantCashFlowSnapshot;
  financialRisks: FinanceAssistantResolvedRisk[];
  paymentDelays: FinanceAssistantInvoiceSummary[];
  contractValue: FinanceAssistantContractValue;
  revenueOpportunities: FinanceAssistantResolvedAction[];
  recommendations: FinanceAssistantResolvedAction[];
  confidence: number;
  missingInformation: string[];
  relevantMemories: AIMemoryEntry[];
  crmRecommendations: FinanceAssistantCrmRecommendation[];
}

export interface GeneratedFinanceAssistantBrief {
  context: FinanceAssistantContext;
  brief: FinanceAssistantBrief;
  mock: boolean;
  model: string;
  provider: string;
  promptVersion: string;
  contextVersion: string;
  generatedAt: string;
}

export type GenerateFinanceAssistantBriefResult = { success: true; data: GeneratedFinanceAssistantBrief } | { success: false; error: string };
