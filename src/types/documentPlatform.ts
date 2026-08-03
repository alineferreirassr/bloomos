import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { AutomationConditionOperator } from "@/types/automation";

/**
 * Checkpoint 12 — the Document Intelligence Platform's own domain, in its
 * own file rather than `types/document.ts` on purpose: that file already
 * holds the pre-existing file-storage module's own `Document` (an uploaded
 * file's metadata — `media_asset_id`, `storage_path`, checksum, and a
 * completely different six-value `DocumentStatus`). This is a different
 * concern — a **generated, compiled artifact** produced from a `Template`
 * plus real BloomOS data — so every type below that would otherwise
 * collide is named `Composed*` instead (`ComposedDocument`, not
 * `Document`). `Template`/`MergeContext`/`DocumentBlock`/`MergeFieldDefinition`
 * have no such collision and keep their natural names.
 *
 * This is deliberately **not** a PDF generator: a `ComposedDocument`'s
 * content is a structured block tree (`DocumentBlock[]`), not a rendered
 * file. Preview renders that tree to HTML/React in the browser; nothing in
 * this codebase shells out to a PDF library. Headers, footers, page
 * breaks, tables, and images are real structural block types, not visual
 * affordances layered on top of plain text.
 *
 * `{{merge_field}}` placeholders inside a `TextRun.text` are the same
 * literal convention `types/contractTemplate.ts`/`modules/contracts/mergeFields.ts`
 * already established (both explicitly "architecture only, nothing parses
 * or renders them yet") — this checkpoint is the system that finally
 * implements that seam, generalized across 8 document types instead of
 * contracts alone. `Contract`/`ContractTemplate` themselves are untouched;
 * a `Template` registered here for the `"contract"` document type is a
 * distinct, richer authoring surface a Contract's own `template_id` could
 * point at in a future checkpoint, not a replacement for the Contract
 * business record (signature status, version history) itself.
 */

export const COMPOSED_DOCUMENT_STATUSES = ["draft", "published", "archived"] as const;
export type ComposedDocumentStatus = (typeof COMPOSED_DOCUMENT_STATUSES)[number];

/**
 * Where a Merge Field's value comes from — the Merge Engine's own
 * resolvers (Step 4). v2 Checkpoint 44 added `"lead"`/`"vendor"`/
 * `"proposal"`/`"payments"`/`"journey"`/`"brand"`/`"timeline"` — every one
 * a genuinely new data source this generic engine had no domain for yet
 * (Client/Event/Invoice/Contract already resolve under `"crm"`/`"finance"`,
 * so those were extended in place rather than duplicated as new domains).
 */
export const MERGE_FIELD_DOMAINS = ["workspace", "crm", "finance", "workflow", "automation", "memory", "user", "settings", "lead", "vendor", "proposal", "payments", "journey", "brand", "timeline"] as const;
export type MergeFieldDomain = (typeof MERGE_FIELD_DOMAINS)[number];

export const MERGE_FIELD_VALUE_TYPES = ["string", "number", "boolean", "date", "currency", "list"] as const;
export type MergeFieldValueType = (typeof MERGE_FIELD_VALUE_TYPES)[number];

/**
 * A resolved Merge Field's actual value. `list` values are `MergeValue[]`
 * — the shape a `loop` block iterates over — and a list element may itself
 * be a record (e.g. one Finance line item: `{description, amount}`) rather
 * than a bare scalar, addressed inside a `LoopBlock`'s own `itemBlocks` as
 * `{{item.description}}`/`{{item.amount}}`; a scalar list element is
 * addressed as plain `{{item}}`.
 */
export type MergeValue = string | number | boolean | null | MergeValue[] | { [key: string]: MergeValue };

/**
 * The Step 2 "every document type registers itself" Template Registry's
 * own entry — open, self-registering, exactly mirroring `SettingsSectionDefinition`'s
 * own open-registry precedent from Checkpoint 11. A "document type" is a
 * category (`"contract"`, `"proposal"`, …), never itself a specific
 * authored `Template` — the same "Section is organizational, Setting is a
 * value" split Checkpoint 11 established, applied here as "DocumentType is
 * organizational, Template is the authored document."
 */
export interface DocumentTypeDefinition {
  id: string;
  label: string;
  description: string;
  /** A name from `modules/documentTemplates/documentTypeIcons.ts`'s own lookup map — a string, never a React component reference, keeping this declaration importable from server code (mirrors `modules/settings/sectionIcons.ts`). */
  icon: string;
  /** The Merge Field keys most Templates of this type reference — a suggestion for the Editor's own Variables Panel, never an enforced allowlist (a Template may reference any registered Merge Field). */
  suggestedMergeFieldKeys: string[];
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
}

/**
 * The Step 4 Merge Engine's own registry entry — one resolvable value a
 * Template may reference as `{{key}}`. Mirrors `SettingDefinition`'s own
 * "declaration separate from resolution" split: this only describes the
 * field; `core/documents/mergeEngine.ts` is the one place a `key` actually
 * resolves to a real `MergeValue`. Corresponds 1:1, for the eight
 * pre-existing keys, to `modules/contracts/mergeFields.ts`'s own
 * `MERGE_FIELDS` — registered here under the `"crm"`/`"finance"`/`"workspace"`
 * domains so the generalized engine subsumes that scaffolding instead of
 * duplicating it under a second, parallel concept.
 */
export interface MergeFieldDefinition {
  key: string;
  label: string;
  description: string;
  domain: MergeFieldDomain;
  valueType: MergeFieldValueType;
  /** If true and this key resolves to `null`/`undefined` at compile time, the Compiler raises a `missing_variable` issue rather than silently rendering an empty string. */
  required: boolean;
}

export interface TextRun {
  /** May contain `{{merge_field}}` placeholders — the Template Engine's own substitution target. A compiled Document's `TextRun.text` never contains an unresolved `{{…}}` (the Compiler either substitutes it or raises `missing_variable`). */
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export const DOCUMENT_BLOCK_TYPES = ["heading", "paragraph", "table", "image", "pageBreak", "divider", "conditional", "loop"] as const;
export type DocumentBlockType = (typeof DOCUMENT_BLOCK_TYPES)[number];

export interface HeadingBlock {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  runs: TextRun[];
}

export interface ParagraphBlock {
  id: string;
  type: "paragraph";
  runs: TextRun[];
}

/** `rows[r][c]` is one cell, itself a run list — a cell may contain its own merge-field placeholders and inline formatting, the same as a paragraph. */
export interface TableBlock {
  id: string;
  type: "table";
  rows: TextRun[][][];
}

export interface ImageBlock {
  id: string;
  type: "image";
  /** May itself be a `{{merge_field}}` placeholder (e.g. a Client's own uploaded photo URL), resolved the same way a `TextRun.text` is. */
  src: string;
  alt: string;
}

export interface PageBreakBlock {
  id: string;
  type: "pageBreak";
}

export interface DividerBlock {
  id: string;
  type: "divider";
}

/**
 * A section that only renders when `field` (a Merge Field key) compares
 * true against `value` via `operator` — the exact same `AutomationConditionOperator`
 * vocabulary the Automation/Workflow Condition Engine already uses, so an
 * author configuring "if `finance.outstanding_balance` gt `0`" reads
 * identically to a Workflow Condition node.
 */
export interface ConditionalBlock {
  id: string;
  type: "conditional";
  field: string;
  operator: AutomationConditionOperator;
  value: MergeValue;
  blocks: DocumentBlock[];
}

/** Repeats `itemBlocks` once per entry in `source`'s own resolved `list` value — e.g. a Finance line-item table, or a Checklist's own task list. */
export interface LoopBlock {
  id: string;
  type: "loop";
  source: string;
  itemBlocks: DocumentBlock[];
}

export type DocumentBlock = HeadingBlock | ParagraphBlock | TableBlock | ImageBlock | PageBreakBlock | DividerBlock | ConditionalBlock | LoopBlock;

/** One Merge Field a specific Template actually references — the Step 1 "Variables" concept: an authoring-time declaration distinct from the Merge Field Registry's own platform-wide catalog. */
export interface TemplateVariable {
  key: string;
  /** Used only if the Merge Engine resolves `key` to `null` and the field itself isn't `required` — lets an author supply template-specific fallback text (e.g. "the couple" when `partner_name` is unset) instead of the Compiler raising an issue. */
  fallback: string | null;
}

/**
 * A reusable, authored document — the Step 1 "Template," registered under
 * one `DocumentTypeDefinition`. `content` is the block tree the Template
 * Engine walks; `header`/`footer` are separate block arrays applied to
 * every page a compiled Document renders. Draft/Published/Archived mirrors
 * `Workflow`'s own status machine exactly (Checkpoint 10) — publishing a
 * Template doesn't compile a Document by itself; it only marks the
 * Template as the one members may generate real Documents from.
 */
export interface Template {
  id: string;
  workspaceId: string;
  documentTypeId: string;
  name: string;
  description: string;
  status: ComposedDocumentStatus;
  content: DocumentBlock[];
  header: DocumentBlock[];
  footer: DocumentBlock[];
  variables: TemplateVariable[];
  version: number;
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The record identifying which real BloomOS entities a Document was (or
 * should be) compiled against — the Compiler's own input, and the trail
 * Search/CRM-integration/Finance-integration all read back from. Every
 * field but `workspaceId`/`memberId` is optional: a Welcome Guide might
 * need only a `clientId`, an Invoice document needs an `invoiceId`, a Run
 * Sheet needs an `eventId`.
 */
export interface MergeContext {
  workspaceId: string;
  memberId: string;
  clientId?: string;
  leadId?: string;
  eventId?: string;
  invoiceId?: string;
  contractId?: string;
  /** v2 Checkpoint 44 — powers the `"proposal"` domain's own singular fields (e.g. `proposal_total`), distinct from the `"crm"` domain's own `client_proposal_history` list. */
  proposalId?: string;
  /** v2 Checkpoint 44 — powers the `"vendor"` domain, for vendor-facing documents (a Vendor Guide, a referral letter). */
  vendorId?: string;
  /** Set only when compilation was triggered by a Workflow-compiled Automation (Step 13/14) — powers the `"workflow"` domain's own Merge Fields (e.g. "generated automatically by X"). `null`/absent for a manual generation. */
  automationId?: string;
  automationExecutionId?: string;
}

/** Key facts about what a Document is "about" — Step 15 Search reads this directly, never re-deriving it from `content`. */
export interface ComposedDocumentMetadata {
  title: string;
  description: string;
  tags: string[];
  clientName: string | null;
  eventTitle: string | null;
}

/**
 * A compiled, generated Document — the output of `core/documents/compiler.ts`.
 * `content` here is fully resolved: no `{{…}}` placeholder survives
 * compilation (the Compiler either substitutes every one or refuses to
 * compile — see `DocumentIssueCode`). Draft/Published/Archived mirrors
 * `Template`'s own status machine; a Document's own Draft is freely
 * re-compilable (e.g. re-running the Merge Engine after a Client record
 * changes), but publishing freezes it into an immutable `ComposedDocumentVersion`.
 */
export interface ComposedDocument {
  id: string;
  workspaceId: string;
  templateId: string;
  documentTypeId: string;
  status: ComposedDocumentStatus;
  content: DocumentBlock[];
  mergeContext: MergeContext;
  metadata: ComposedDocumentMetadata;
  currentVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * An immutable, published snapshot — Step 6's own "Immutable versions."
 * There is deliberately no `updateVersion`/`deleteVersion` anywhere in this
 * checkpoint's own repository interface; a version can only ever be
 * created, the same guarantee `WorkflowVersion` already established.
 */
export interface ComposedDocumentVersion {
  id: string;
  documentId: string;
  version: number;
  content: DocumentBlock[];
  metadata: ComposedDocumentMetadata;
  compiledBy: string;
  compiledAt: string;
  /** An optional human-readable note ("Sent to client for signature") — never required, never parsed. */
  label: string | null;
}

/**
 * v2 Checkpoint 44, Step 5 — a Document Bundle groups Documents/Proposals/
 * Contracts/Invoices for one Client into a single sendable package, purely
 * by reference. `refId` points at the real record in its own owning
 * system (`ComposedDocument` here, or Proposal/Contract/Invoice in their
 * own platforms) — a Bundle never stores a copy of that record's content,
 * so editing or re-versioning the original is instantly reflected
 * wherever the Bundle is viewed. Mirrors the reference-only relationship
 * `DocumentBundleItem` has to its target the same way a Workflow node
 * references an Automation Action definition rather than embedding it.
 */
export const DOCUMENT_BUNDLE_ITEM_KINDS = ["composed_document", "proposal", "contract", "invoice"] as const;
export type DocumentBundleItemKind = (typeof DOCUMENT_BUNDLE_ITEM_KINDS)[number];

export interface DocumentBundleItem {
  id: string;
  kind: DocumentBundleItemKind;
  /** The id of the real record this item points at. Never a copy of that record's own data. */
  refId: string;
  addedAt: string;
}

export const DOCUMENT_BUNDLE_STATUSES = ["draft", "ready", "sent", "viewed"] as const;
export type DocumentBundleStatus = (typeof DOCUMENT_BUNDLE_STATUSES)[number];

export interface DocumentBundle {
  id: string;
  workspaceId: string;
  clientId: string | null;
  eventId: string | null;
  title: string;
  description: string;
  status: DocumentBundleStatus;
  items: DocumentBundleItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
}

/** One Bundle item's own live display summary, assembled at read time from its real record — never persisted, so it can never drift out of sync with the source. `available: false` means the referenced record no longer exists (e.g. an archived Proposal). */
export interface ResolvedDocumentBundleItem {
  item: DocumentBundleItem;
  title: string;
  subtitle: string | null;
  available: boolean;
}

export const DOCUMENT_ISSUE_CODES = ["missing_variable", "invalid_formatting", "unknown_field", "permission_denied", "unknown_template"] as const;
export type DocumentIssueCode = (typeof DOCUMENT_ISSUE_CODES)[number];

export interface DocumentIssue {
  code: DocumentIssueCode;
  /** The offending Merge Field key or block id, when applicable — `null` for a Template-level issue like `unknown_template`. */
  target: string | null;
  message: string;
}

export type DocumentCompileResult = { success: true; document: ComposedDocument } | { success: false; issues: DocumentIssue[] };

/**
 * Step 10's own "Bloom AI may suggest wording... never publish
 * automatically" — inert by design, the same precedent `SettingRecommendation`
 * (Checkpoint 11) and Workflow's own deterministic suggestions (Checkpoint
 * 10) already established. Nothing holding one of these ever edits a
 * Template/Document by itself.
 */
export interface DocumentSuggestion {
  templateId: string;
  /** The block id this suggestion applies to — `null` for a whole-document suggestion (e.g. "this Template has no Welcome Guide-suggested fields referenced at all"). */
  blockId: string | null;
  kind: "missing_section" | "wording" | "tone";
  reason: string;
  suggestedRuns: TextRun[] | null;
}

// ---------------------------------------------------------------------------
// v2 Checkpoint 44, Step 12 — Document Health + Document Analytics. Two
// separate Health category unions (`ComposedDocument`, `DocumentBundle`) —
// the same "parallel type, not a reuse, since each checkpoint's own category
// union is closed and distinct" precedent `ContractHealthCategoryScore`
// already established, rather than one shared generic category type.
// ---------------------------------------------------------------------------

export const COMPOSED_DOCUMENT_HEALTH_CATEGORIES = ["completeness", "context_link", "versioning"] as const;
export type ComposedDocumentHealthCategory = (typeof COMPOSED_DOCUMENT_HEALTH_CATEGORIES)[number];

export const COMPOSED_DOCUMENT_HEALTH_CATEGORY_LABELS: Record<ComposedDocumentHealthCategory, string> = {
  completeness: "Completeness",
  context_link: "Context Link",
  versioning: "Versioning",
};

export interface ComposedDocumentHealthCategoryScore {
  category: ComposedDocumentHealthCategory;
  score: number | null;
  issues: string[];
  notApplicableReason: string | null;
}

export interface ComposedDocumentHealth {
  categories: ComposedDocumentHealthCategoryScore[];
  overallScore: number;
  evaluatedAt: string;
}

export const DOCUMENT_BUNDLE_HEALTH_CATEGORIES = ["completeness", "items_availability", "client_link", "send_readiness"] as const;
export type DocumentBundleHealthCategory = (typeof DOCUMENT_BUNDLE_HEALTH_CATEGORIES)[number];

export const DOCUMENT_BUNDLE_HEALTH_CATEGORY_LABELS: Record<DocumentBundleHealthCategory, string> = {
  completeness: "Completeness",
  items_availability: "Items Availability",
  client_link: "Client Link",
  send_readiness: "Send Readiness",
};

export interface DocumentBundleHealthCategoryScore {
  category: DocumentBundleHealthCategory;
  score: number | null;
  issues: string[];
  notApplicableReason: string | null;
}

export interface DocumentBundleHealth {
  categories: DocumentBundleHealthCategoryScore[];
  overallScore: number;
  evaluatedAt: string;
}

/** The Business Health Engine's own optional-input shape for this domain — mirrors `SearchHealthReport`'s "overallScore + flattened issues" summary, the same shape `computeBusinessHealth`'s `searchHealth` param already consumes. `overallScore: null` when there's nothing to score yet (no Documents or Bundles), read by `computeBusinessHealth` as "not applicable" the same way an absent `workflowHealth` is. */
export interface DocumentPlatformHealthSummary {
  overallScore: number | null;
  issues: string[];
}

/** Pure aggregation over already-fetched `ComposedDocument[]`/`DocumentBundle[]` — the same "no store access, no `Date.now()`" discipline `ProposalAnalyticsSnapshot` (Checkpoint 33) already established. */
export interface DocumentAnalyticsSnapshot {
  totalComposedDocuments: number;
  draftDocumentCount: number;
  publishedDocumentCount: number;
  archivedDocumentCount: number;
  templateUsage: Record<string, number>;
  documentTypeUsage: Record<string, number>;
  totalBundles: number;
  bundleStatusCounts: Record<DocumentBundleStatus, number>;
  averageItemsPerBundle: number;
  bundleItemKindUsage: Record<string, number>;
  evaluatedAt: string;
}
