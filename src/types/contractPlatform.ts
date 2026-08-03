import type { Contract } from "@/types/contract";
import type { ContractStatus } from "@/core/enums/contractStatus";

/**
 * v2.0 Checkpoint 34 — Contract Management Platform. `Contract`
 * (`types/contract.ts`, real Supabase-backed entity) stays the single
 * source of truth for the contract's own commercial/e-signature lifecycle
 * (`status`/`signature_status`, `sendContract`/`markSigned`/etc. in
 * `modules/contracts/`) — nothing here duplicates it. Everything in this
 * file is an ADDITIVE layer on top of an existing `Contract.id`: the
 * human-curated document (template, sections, clauses, variables,
 * pricing reference) that gets built, versioned, compared, and prepared —
 * never the real contract record, and never electronic signing (out of
 * scope until the future External Integrations phase).
 *
 * `ContractExhibit` (`types/contractExhibit.ts`, already the real
 * "named attachment" entity, with full CRUD and its own `ExhibitsSection.tsx`
 * UI) is reused directly wherever this checkpoint's spec says
 * "Attachments" — this file never re-models attachments as a new type,
 * only ever freezes a `ContractExhibit.id[]` reference list inside a
 * snapshot.
 *
 * `ContractTemplate` (`types/contractTemplate.ts`) already exists — a
 * real, workspace-scoped, but deliberately minimal entity: a flat `body`
 * string with literal `{{merge_field}}` placeholders, read-only (its own
 * migration seeds zero rows and grants no insert/update/delete), with no
 * renderer anywhere. It is NOT reused as this checkpoint's own Template
 * Library, because the spec wants a genuinely richer, structured concept
 * (sections/clauses/variables/attachments/optional-clauses/signature-
 * placeholders) that flat text can't represent, and because writing to
 * the real `contract_templates` table would mean a new Supabase
 * migration — a materially bigger, riskier change than anything else
 * this checkpoint needs, breaking the "no new migration without a
 * verified release blocker" rule every mock-first Platform in this
 * codebase has followed. `ContractBuilderTemplate` below is therefore a
 * new, additive, mock-only type, deliberately named to never collide
 * with the real `ContractTemplate` import — the real one keeps its own
 * job (category tagging, already wired into `ContractForm.tsx`/
 * `ContractDetailView.tsx`); this one is the Builder's own library.
 */

export type { Contract } from "@/types/contract";
export type { ContractStatus } from "@/core/enums/contractStatus";
export type { ContractExhibit } from "@/types/contractExhibit";

// ---------------------------------------------------------------------------
// Step 2 — Contract Builder Template Library
// ---------------------------------------------------------------------------

export const CONTRACT_BUILDER_TEMPLATE_KEYS = [
  "master_service_agreement",
  "proposal_agreement",
  "picnic_agreement",
  "hotel_decoration_agreement",
  "photography_agreement",
  "ugc_agreement",
  "vendor_agreement",
  "independent_contractor",
  "nda",
  "employment_agreement",
  "custom_template",
] as const;
export type ContractBuilderTemplateKey = (typeof CONTRACT_BUILDER_TEMPLATE_KEYS)[number];

export const CONTRACT_BUILDER_TEMPLATE_LABELS: Record<ContractBuilderTemplateKey, string> = {
  master_service_agreement: "Master Service Agreement",
  proposal_agreement: "Proposal Agreement",
  picnic_agreement: "Picnic Agreement",
  hotel_decoration_agreement: "Hotel Decoration Agreement",
  photography_agreement: "Photography Agreement",
  ugc_agreement: "UGC Agreement",
  vendor_agreement: "Vendor Agreement",
  independent_contractor: "Independent Contractor",
  nda: "NDA",
  employment_agreement: "Employment Agreement",
  custom_template: "Custom Template",
};

export interface ContractHeaderContent {
  title: string;
  subtitle: string | null;
  logoAssetId: string | null;
}

export interface ContractFooterContent {
  text: string;
  contactEmail: string | null;
  contactPhone: string | null;
}

/**
 * The 8 template surfaces Step 2 names: Header, Sections, Variables,
 * Clauses, Attachments, Optional Clauses, Signature Placeholders, Footer.
 * "Variables"/"Attachments" need no config of their own — variables are
 * always resolved fresh by the Variable Engine, and attachments are
 * always real `ContractExhibit` rows, so a template only needs to say
 * *which* clauses are default vs. optional and whether it renders
 * signature placeholders at all.
 */
export interface ContractBuilderTemplateStructure {
  header: ContractHeaderContent;
  sectionKeys: ContractSectionKey[];
  defaultClauseKeys: ContractClauseKey[];
  optionalClauseKeys: ContractClauseKey[];
  hasSignaturePlaceholders: boolean;
  footer: ContractFooterContent;
}

export interface ContractBuilderTemplate {
  id: string;
  workspace_id: string;
  key: ContractBuilderTemplateKey;
  name: string;
  description: string;
  isSystemTemplate: boolean;
  structure: ContractBuilderTemplateStructure;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// ---------------------------------------------------------------------------
// Step 3 — Contract Builder blocks
// ---------------------------------------------------------------------------

export const CONTRACT_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "rich_text",
  "variable",
  "clause_block",
  "pricing_reference",
  "proposal_reference",
  "image",
  "table",
  "attachment_placeholder",
  "signature_placeholder",
  "initial_placeholder",
  "divider",
  "custom",
] as const;
export type ContractBlockType = (typeof CONTRACT_BLOCK_TYPES)[number];

export const CONTRACT_BLOCK_TYPE_LABELS: Record<ContractBlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  rich_text: "Rich Text",
  variable: "Variables",
  clause_block: "Clause Block",
  pricing_reference: "Pricing Reference",
  proposal_reference: "Proposal Reference",
  image: "Image",
  table: "Table",
  attachment_placeholder: "Attachment Placeholder",
  signature_placeholder: "Signature Placeholder",
  initial_placeholder: "Initial Placeholder",
  divider: "Divider",
  custom: "Custom Block",
};

/**
 * One block inside a section. `clause_block` carries no independent text —
 * it marks "render this Clause Library entry here" via `clauseId`, pulling
 * the clause's own `bodyText` rather than storing a second copy.
 * `pricing_reference`/`proposal_reference` blocks likewise carry no
 * content of their own — they mark "render the linked Proposal's own
 * pricing/summary here," pulling from the snapshot's own
 * `pricingReference` rather than duplicating a Proposal's figures.
 * `attachment_placeholder` marks "list these real Contract Exhibits here"
 * via `attachmentIds` — never a second attachment record.
 */
export interface ContractBlock {
  id: string;
  type: ContractBlockType;
  order: number;
  heading: string | null;
  text: string | null;
  variableKeys: string[];
  clauseId: string | null;
  mediaAssetIds: string[];
  tableRows: string[][];
  attachmentIds: string[];
  placeholderLabel: string | null;
}

// ---------------------------------------------------------------------------
// Generic section containers (no named Section Library like Proposal's —
// Step 4's own named library is the Clause Library below; sections here are
// plain structural containers a template's sectionKeys populate by default).
// ---------------------------------------------------------------------------

export const CONTRACT_SECTION_KEYS = ["parties", "recitals", "scope_of_services", "payment_terms", "term_and_termination", "clauses", "signatures", "custom_section"] as const;
export type ContractSectionKey = (typeof CONTRACT_SECTION_KEYS)[number];

export const CONTRACT_SECTION_LABELS: Record<ContractSectionKey, string> = {
  parties: "Parties",
  recitals: "Recitals",
  scope_of_services: "Scope of Services",
  payment_terms: "Payment Terms",
  term_and_termination: "Term & Termination",
  clauses: "Clauses",
  signatures: "Signatures",
  custom_section: "Custom Section",
};

export interface ContractSection {
  id: string;
  key: ContractSectionKey;
  title: string;
  isCustom: boolean;
  blocks: ContractBlock[];
}

// ---------------------------------------------------------------------------
// Step 4 — Clause Library
// ---------------------------------------------------------------------------

export const CONTRACT_CLAUSE_KEYS = [
  "payment_terms",
  "cancellation_policy",
  "reschedule_policy",
  "refund_policy",
  "force_majeure",
  "privacy",
  "confidentiality",
  "liability",
  "intellectual_property",
  "photo_release",
  "video_release",
  "travel_policy",
  "damage_policy",
  "late_payment",
  "custom_clause",
] as const;
export type ContractClauseKey = (typeof CONTRACT_CLAUSE_KEYS)[number];

export const CONTRACT_CLAUSE_LABELS: Record<ContractClauseKey, string> = {
  payment_terms: "Payment Terms",
  cancellation_policy: "Cancellation Policy",
  reschedule_policy: "Reschedule Policy",
  refund_policy: "Refund Policy",
  force_majeure: "Force Majeure",
  privacy: "Privacy",
  confidentiality: "Confidentiality",
  liability: "Liability",
  intellectual_property: "Intellectual Property",
  photo_release: "Photo Release",
  video_release: "Video Release",
  travel_policy: "Travel Policy",
  damage_policy: "Damage Policy",
  late_payment: "Late Payment",
  custom_clause: "Custom Clause",
};

/** `bodyText` may itself contain `{{variable}}` placeholders — the Variable Engine substitutes into clause text exactly like any other block. `isOptional` is the spec's own named "Optional Clauses" — a clause a template marks optional can be included/excluded per contract without being removed from the library. */
export interface ContractClause {
  id: string;
  workspace_id: string;
  key: ContractClauseKey;
  name: string;
  category: string;
  bodyText: string;
  isOptional: boolean;
  isCustom: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// ---------------------------------------------------------------------------
// Step 5 — Variable Engine
// ---------------------------------------------------------------------------

/** Resolved from real records only — never invented, never AI-generated. A variable with no real source value resolves to an empty string, disclosed, rather than a fabricated one. */
export interface ContractVariable {
  key: string;
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Pricing reference — frozen, never live, resolved from a linked Proposal
// ---------------------------------------------------------------------------

export interface ContractPricingReference {
  proposalId: string | null;
  grandTotal_minor: number | null;
  currency: string | null;
  depositDue_minor: number | null;
  remainingBalance_minor: number | null;
}

// ---------------------------------------------------------------------------
// Step 1 + 6 — Snapshot, Version, and the builder shell
// ---------------------------------------------------------------------------

export interface ContractSnapshot {
  id: string;
  captured_at: string;
  builderTemplateId: string | null;
  builderTemplateKey: ContractBuilderTemplateKey | null;
  header: ContractHeaderContent;
  sections: ContractSection[];
  clauseIds: string[];
  variables: ContractVariable[];
  pricingReference: ContractPricingReference | null;
  /** Real `ContractExhibit.id`s attached at capture time — the exhibits themselves keep their own independent lifecycle via the existing `ExhibitsSection.tsx`, never duplicated here. */
  attachmentIds: string[];
  terms: string;
  policies: string;
  footer: ContractFooterContent;
}

export interface ContractVersion {
  id: string;
  contract_id: string;
  workspace_id: string;
  version_number: number;
  snapshot: ContractSnapshot;
  notes: string | null;
  reason: string | null;
  created_by: string;
  created_at: string;
}

export const CONTRACT_DOCUMENT_STATUSES = ["draft", "review", "published", "archived"] as const;
export type ContractDocumentStatus = (typeof CONTRACT_DOCUMENT_STATUSES)[number];

/**
 * The mutable shell around append-only `ContractVersion` history — the
 * exact `ExecutionPackage`/`ProposalBuilderState` pattern, scoped to this
 * checkpoint's own new document-authoring concerns and kept entirely
 * separate from the real `Contract` row (see this file's top-level doc
 * comment). Deliberately named/labeled "Document" everywhere in the UI
 * ("Publish Document", "Archive Document") to avoid colliding with the
 * real Contract's own status machine and its existing "Archive"/"Restore"
 * actions in `ContractActions.tsx`.
 */
export interface ContractBuilderState {
  id: string;
  contract_id: string;
  workspace_id: string;
  status: ContractDocumentStatus;
  current_version_id: string | null;
  versions: ContractVersion[];
  /** Set the first time Readiness reaches `"ready"` — powers the "Ready" Timeline event and the Analytics "Time To Ready" metric. Never cleared once set, even if a later edit regresses readiness — it records when the document first became ready, not its current state. */
  ready_at: string | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateContractVersionInput {
  builderTemplateId: string | null;
  builderTemplateKey: ContractBuilderTemplateKey | null;
  header: ContractHeaderContent;
  sections: ContractSection[];
  clauseIds: string[];
  terms: string;
  policies: string;
  footer: ContractFooterContent;
  notes: string | null;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Step 7 — Comparison Engine
// ---------------------------------------------------------------------------

export const CONTRACT_DIFF_CATEGORIES = ["clauses", "variables", "pricing_references", "sections", "attachments", "terms", "policies"] as const;
export type ContractDiffCategory = (typeof CONTRACT_DIFF_CATEGORIES)[number];

export const CONTRACT_DIFF_CHANGE_TYPES = ["added", "removed", "changed"] as const;
export type ContractDiffChangeType = (typeof CONTRACT_DIFF_CHANGE_TYPES)[number];

export interface ContractDiffEntry {
  category: ContractDiffCategory;
  field: string;
  before: string | null;
  after: string | null;
  changeType: ContractDiffChangeType;
}

export interface ContractComparisonResult {
  versionANumber: number;
  versionBNumber: number;
  diffs: ContractDiffEntry[];
  hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Step 8 — Contract Health Engine
// ---------------------------------------------------------------------------

export const CONTRACT_HEALTH_CATEGORIES = ["completeness", "missing_variables", "missing_clauses", "missing_sections", "proposal_link", "journey_link", "client_link"] as const;
export type ContractHealthCategory = (typeof CONTRACT_HEALTH_CATEGORIES)[number];

export const CONTRACT_HEALTH_CATEGORY_LABELS: Record<ContractHealthCategory, string> = {
  completeness: "Completeness",
  missing_variables: "Missing Variables",
  missing_clauses: "Missing Clauses",
  missing_sections: "Missing Sections",
  proposal_link: "Proposal Link",
  journey_link: "Journey Link",
  client_link: "Client Link",
};

/** Same shape as `HealthCategoryScore`/`ProposalHealthCategoryScore` — a parallel type, not a reuse, since each checkpoint's own category union is closed and distinct. */
export interface ContractHealthCategoryScore {
  category: ContractHealthCategory;
  score: number | null;
  issues: string[];
  notApplicableReason: string | null;
}

export interface ContractHealth {
  categories: ContractHealthCategoryScore[];
  overallScore: number;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Step 9 — Contract Readiness
// ---------------------------------------------------------------------------

export const CONTRACT_READINESS_STATES = ["ready", "needs_review", "missing_variables", "missing_client", "missing_proposal", "missing_sections", "missing_clauses", "needs_approval"] as const;
export type ContractReadinessState = (typeof CONTRACT_READINESS_STATES)[number];

export const CONTRACT_READINESS_LABELS: Record<ContractReadinessState, string> = {
  ready: "Ready",
  needs_review: "Needs Review",
  missing_variables: "Missing Variables",
  missing_client: "Missing Client",
  missing_proposal: "Missing Proposal",
  missing_sections: "Missing Sections",
  missing_clauses: "Missing Clauses",
  needs_approval: "Needs Approval",
};

/** `canPublish` is the spec's own named "Can Publish"/"Cannot Publish" — a derived boolean (`state === "ready"`), the same `ProposalReadinessResult.canSend` precedent. */
export interface ContractReadinessResult {
  state: ContractReadinessState;
  reasons: string[];
  canPublish: boolean;
}

// ---------------------------------------------------------------------------
// Step 11 — Contract Analytics
// ---------------------------------------------------------------------------

export interface ContractAnalyticsSnapshot {
  totalContracts: number;
  draftCount: number;
  reviewCount: number;
  publishedCount: number;
  archivedCount: number;
  averageContractValue_minor: number;
  averageRevisionCount: number;
  templateUsage: Record<string, number>;
  clauseUsage: Record<string, number>;
  averageTimeInDraftHours: number | null;
  averageTimeToReadyHours: number | null;
  /** Ready-or-published contracts / total contracts with a document ever started — the document-preparation completion rate, distinct from the real Contract's own commercial `status`. */
  completionRate: number;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Composed read models (never persisted, computed fresh)
// ---------------------------------------------------------------------------

export interface ContractSummary {
  contractId: string;
  clientId: string;
  eventId: string | null;
  documentStatus: ContractDocumentStatus;
  contractStatus: ContractStatus;
  currentVersionNumber: number | null;
  templateKey: ContractBuilderTemplateKey | null;
  totalValue_minor: number | null;
  currency: string;
  overallHealthScore: number;
  readinessState: ContractReadinessState;
  readyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractDetail {
  contract: Contract;
  builderState: ContractBuilderState | null;
  currentVersion: ContractVersion | null;
  health: ContractHealth;
  readiness: ContractReadinessResult;
}
