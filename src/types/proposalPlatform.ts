import type { ProposalDraft, ProposalStatus } from "@/types/proposal";

/**
 * v2.0 Checkpoint 33 — Proposal & Quote Platform. This is NOT a second
 * Proposal system: `ProposalDraft` (`types/proposal.ts`, Checkpoint 3) stays
 * the single source of truth for AI-generated content and its own
 * draft/accepted/rejected/superseded lifecycle. Everything in this file is
 * an ADDITIVE layer on top of an existing `ProposalDraft.id` — the
 * human-curated document (template, sections, blocks, packages, add-ons,
 * pricing, versions, distribution state) that gets built, versioned,
 * compared, and presented to a client. `ProposalDraft` is re-exported here
 * under the domain's own vocabulary (`Proposal`/`ProposalStatus`) rather
 * than duplicated.
 *
 * Version/Snapshot architecture is a deliberate mirror of Execution
 * Package's own `ExecutionPackage`/`ExecutionVersion`/`ExecutionSnapshot`
 * shape (`types/executionPackage.ts`, Checkpoint 27.3): a mutable shell
 * (`ProposalBuilderState`) holds an append-only `versions` history; each
 * `ProposalVersion` freezes a `ProposalSnapshot` by value, never a live
 * reference. `ProposalBuilderState` is a NEW shell distinct from
 * `ProposalDraft` specifically so this checkpoint never mutates the
 * existing AI-generation entity or its ~15 existing call sites — it is a
 * 1:1 companion record keyed by `proposal_id`.
 */

export type { ProposalDraft as Proposal, ProposalStatus } from "@/types/proposal";

// ---------------------------------------------------------------------------
// Step 2 — Proposal Template Library
// ---------------------------------------------------------------------------

export const PROPOSAL_TEMPLATE_KEYS = [
  "luxury_proposal",
  "picnic_proposal",
  "hotel_decoration",
  "proposal_event",
  "photography",
  "ugc_services",
  "digital_services",
  "general_services",
  "custom_template",
] as const;
export type ProposalTemplateKey = (typeof PROPOSAL_TEMPLATE_KEYS)[number];

export const PROPOSAL_TEMPLATE_LABELS: Record<ProposalTemplateKey, string> = {
  luxury_proposal: "Luxury Proposal",
  picnic_proposal: "Picnic Proposal",
  hotel_decoration: "Hotel Decoration",
  proposal_event: "Proposal Event",
  photography: "Photography",
  ugc_services: "UGC Services",
  digital_services: "Digital Services",
  general_services: "General Services",
  custom_template: "Custom Template",
};

export interface ProposalHeaderContent {
  title: string;
  subtitle: string | null;
  logoAssetId: string | null;
}

export interface ProposalHeroContent {
  headline: string;
  subheadline: string | null;
  imageAssetId: string | null;
}

export interface ProposalFooterContent {
  text: string;
  contactEmail: string | null;
  contactPhone: string | null;
}

/**
 * The 9 template surfaces named in Step 2. `gallery`/`pricing`/`timeline`/
 * `faq` are booleans (does this template render that surface at all) rather
 * than nested config, since their actual content always comes from the
 * document's own `sections`/`packageIds`/pricing engine output, never a
 * second copy stored on the template.
 */
export interface ProposalTemplateStructure {
  header: ProposalHeaderContent;
  hero: ProposalHeroContent;
  sectionKeys: ProposalSectionKey[];
  gallery: boolean;
  pricing: boolean;
  timeline: boolean;
  faq: boolean;
  terms: boolean;
  policies: boolean;
  footer: ProposalFooterContent;
}

export interface ProposalTemplate {
  id: string;
  workspace_id: string;
  key: ProposalTemplateKey;
  name: string;
  description: string;
  /** System templates ship pre-seeded (the 8 named non-custom keys) and cannot be deleted, only cloned into a workspace custom template — the same "system vs. custom" split `ChecklistTemplate` established. */
  isSystemTemplate: boolean;
  structure: ProposalTemplateStructure;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// ---------------------------------------------------------------------------
// Step 3 — Proposal Builder blocks
// ---------------------------------------------------------------------------

export const PROPOSAL_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "image",
  "gallery",
  "pricing_table",
  "package_table",
  "timeline",
  "faq",
  "callout",
  "divider",
  "feature_grid",
  "video_placeholder",
  "button_placeholder",
  "signature_placeholder",
  "custom",
] as const;
export type ProposalBlockType = (typeof PROPOSAL_BLOCK_TYPES)[number];

export const PROPOSAL_BLOCK_TYPE_LABELS: Record<ProposalBlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  image: "Image",
  gallery: "Gallery",
  pricing_table: "Pricing Table",
  package_table: "Package Table",
  timeline: "Timeline",
  faq: "FAQ",
  callout: "Callout",
  divider: "Divider",
  feature_grid: "Feature Grid",
  video_placeholder: "Video Placeholder",
  button_placeholder: "Button Placeholder",
  signature_placeholder: "Signature Placeholder",
  custom: "Custom Block",
};

export const PROPOSAL_CALLOUT_TONES = ["info", "success", "warning"] as const;
export type ProposalCalloutTone = (typeof PROPOSAL_CALLOUT_TONES)[number];

/** One FAQ/feature-grid/timeline row — a single flexible shape rather than three near-identical interfaces. */
export interface ProposalBlockListItem {
  label: string;
  description: string | null;
}

/**
 * One block inside a section. `pricing_table`/`package_table` blocks carry
 * no independent content — they mark "render the live Pricing Engine
 * output here" / "render these selected packages here", pulling from the
 * document's own `packageIds`/computed `ProposalPricing` rather than
 * storing a second copy. The 3 placeholder types (`video_placeholder`/
 * `button_placeholder`/`signature_placeholder`) render a labeled visual
 * slot only — Step 20/22's stop condition forbids real video embeds, real
 * outbound links, and real e-signatures this checkpoint.
 */
export interface ProposalBlock {
  id: string;
  type: ProposalBlockType;
  order: number;
  heading: string | null;
  text: string | null;
  mediaAssetIds: string[];
  items: ProposalBlockListItem[];
  packageIds: string[];
  tone: ProposalCalloutTone | null;
  placeholderLabel: string | null;
}

// ---------------------------------------------------------------------------
// Step 4 — Proposal Section Library
// ---------------------------------------------------------------------------

export const PROPOSAL_SECTION_KEYS = [
  "about_us",
  "luxury_experience",
  "our_process",
  "timeline",
  "whats_included",
  "faq",
  "testimonials_placeholder",
  "gallery_placeholder",
  "payment_schedule",
  "terms",
  "policies",
  "cancellation",
  "custom_section",
] as const;
export type ProposalSectionKey = (typeof PROPOSAL_SECTION_KEYS)[number];

export const PROPOSAL_SECTION_LABELS: Record<ProposalSectionKey, string> = {
  about_us: "About Us",
  luxury_experience: "Luxury Experience",
  our_process: "Our Process",
  timeline: "Timeline",
  whats_included: "What's Included",
  faq: "Frequently Asked Questions",
  testimonials_placeholder: "Testimonials Placeholder",
  gallery_placeholder: "Gallery Placeholder",
  payment_schedule: "Payment Schedule",
  terms: "Terms",
  policies: "Policies",
  cancellation: "Cancellation",
  custom_section: "Custom Section",
};

/** One assembled section of a proposal document — either from the reusable library (`isCustom: false`, `key` one of the 12 named sections) or authored freehand (`isCustom: true`, `key: "custom_section"`). */
export interface ProposalSection {
  id: string;
  key: ProposalSectionKey;
  title: string;
  isCustom: boolean;
  blocks: ProposalBlock[];
}

// ---------------------------------------------------------------------------
// Step 6 — Package Builder
// ---------------------------------------------------------------------------

export const PROPOSAL_PACKAGE_KEYS = [
  "luxury_picnic",
  "beach_proposal",
  "birthday",
  "hotel_decoration",
  "photography",
  "ugc_campaign",
  "digital_package",
  "custom_package",
] as const;
export type ProposalPackageKey = (typeof PROPOSAL_PACKAGE_KEYS)[number];

export const PROPOSAL_PACKAGE_LABELS: Record<ProposalPackageKey, string> = {
  luxury_picnic: "Luxury Picnic",
  beach_proposal: "Beach Proposal",
  birthday: "Birthday",
  hotel_decoration: "Hotel Decoration",
  photography: "Photography",
  ugc_campaign: "UGC Campaign",
  digital_package: "Digital Package",
  custom_package: "Custom Package",
};

export interface ProposalPackage {
  id: string;
  workspace_id: string;
  key: ProposalPackageKey;
  name: string;
  description: string;
  category: string;
  basePrice_minor: number;
  currency: string;
  /** Add-ons bundled into this package by default — a proposal may still list them separately if `optional` is toggled off at selection time. */
  includedAddonIds: string[];
  isCustom: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// ---------------------------------------------------------------------------
// Step 7 — Add-on Engine
// ---------------------------------------------------------------------------

export const PROPOSAL_ADDON_KEYS = [
  "flowers",
  "champagne",
  "drone",
  "photography",
  "videography",
  "luxury_basket",
  "live_music",
  "candles",
  "transportation_placeholder",
  "custom_decor",
] as const;
export type ProposalAddonKey = (typeof PROPOSAL_ADDON_KEYS)[number];

export const PROPOSAL_ADDON_LABELS: Record<ProposalAddonKey, string> = {
  flowers: "Flowers",
  champagne: "Champagne",
  drone: "Drone",
  photography: "Photography",
  videography: "Videography",
  luxury_basket: "Luxury Basket",
  live_music: "Live Music",
  candles: "Candles",
  transportation_placeholder: "Transportation Placeholder",
  custom_decor: "Custom Decor",
};

export interface ProposalAddon {
  id: string;
  workspace_id: string;
  key: ProposalAddonKey;
  name: string;
  description: string;
  category: string;
  price_minor: number;
  currency: string;
  isCustom: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// ---------------------------------------------------------------------------
// Step 5 — Pricing Engine
// ---------------------------------------------------------------------------

export const PROPOSAL_PRICING_LINE_KINDS = ["package", "addon", "optional_service", "custom_line"] as const;
export type ProposalPricingLineKind = (typeof PROPOSAL_PRICING_LINE_KINDS)[number];

export interface ProposalPricingLineInput {
  kind: ProposalPricingLineKind;
  /** `ProposalPackage.id`/`ProposalAddon.id` for `package`/`addon` lines; `null` for `optional_service`/`custom_line`, which have no library entity behind them. */
  refId: string | null;
  label: string;
  unitPrice_minor: number;
  quantity: number;
  /** Optional services are quoted but excluded from `grandTotal_minor` unless the client/staff explicitly includes them — `subtotal_minor` always includes every non-optional line. */
  isOptional: boolean;
}

export const PROPOSAL_DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export type ProposalDiscountType = (typeof PROPOSAL_DISCOUNT_TYPES)[number];

export interface ProposalDiscountInput {
  type: ProposalDiscountType;
  /** Percentage points (0–100) for `"percentage"`, minor units for `"fixed"`. */
  value: number;
  label: string | null;
}

/**
 * `couponCode`/`taxRate` are the spec's own named "Coupons Placeholder"/
 * "Taxes Placeholder" — carried as plain fields with no external
 * validation or jurisdiction-aware calculation (no coupon provider, no tax
 * service is ever called this checkpoint). When `taxRate` is set, tax is
 * computed as a flat `subtotal * rate` — disclosed as a placeholder
 * calculation, not a real tax engine.
 */
export interface ProposalPricingInput {
  currency: string;
  basePrice_minor: number;
  lines: ProposalPricingLineInput[];
  discount: ProposalDiscountInput | null;
  couponCode: string | null;
  taxRatePercent: number | null;
  depositPercent: number | null;
}

export interface ProposalPricingLineResult extends ProposalPricingLineInput {
  lineTotal_minor: number;
}

export interface ProposalPricing {
  currency: string;
  basePrice_minor: number;
  lineItems: ProposalPricingLineResult[];
  packagesSubtotal_minor: number;
  addonsSubtotal_minor: number;
  optionalServicesTotal_minor: number;
  subtotal_minor: number;
  discountAmount_minor: number;
  taxAmount_minor: number;
  grandTotal_minor: number;
  depositDue_minor: number;
  remainingBalance_minor: number;
}

// ---------------------------------------------------------------------------
// Step 1 — Proposal Variables
// ---------------------------------------------------------------------------

/** Merge-field style variables resolved from real records (client name, event date, workspace name) — never invented; a variable with no real source value is simply omitted, not fabricated. */
export interface ProposalVariable {
  key: string;
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Step 1 + 8 — Snapshot, Version, and the builder shell
// ---------------------------------------------------------------------------

export interface ProposalSnapshot {
  id: string;
  captured_at: string;
  template_id: string | null;
  templateKey: ProposalTemplateKey | null;
  header: ProposalHeaderContent;
  hero: ProposalHeroContent;
  sections: ProposalSection[];
  packageIds: string[];
  addonIds: string[];
  variables: ProposalVariable[];
  pricing: ProposalPricing;
  terms: string;
  policies: string;
  footer: ProposalFooterContent;
}

export interface ProposalVersion {
  id: string;
  proposal_id: string;
  workspace_id: string;
  version_number: number;
  snapshot: ProposalSnapshot;
  notes: string | null;
  reason: string | null;
  created_by: string;
  created_at: string;
}

export const PROPOSAL_DOCUMENT_STATUSES = ["draft", "revision", "published", "archived"] as const;
export type ProposalDocumentStatus = (typeof PROPOSAL_DOCUMENT_STATUSES)[number];

/**
 * The mutable shell around append-only `ProposalVersion` history — the
 * exact `ExecutionPackage` pattern (Checkpoint 27.3), scoped to this
 * checkpoint's own new document-authoring concerns and kept entirely
 * separate from `ProposalDraft` (see this file's top-level doc comment).
 * `"revision"` covers both "a revision was requested by the client" and
 * "staff is actively editing a published proposal into its next version" —
 * a real state transition, not a fabricated one, since both leave the
 * currently-published version intact until a new one publishes over it.
 */
export interface ProposalBuilderState {
  id: string;
  proposal_id: string;
  workspace_id: string;
  status: ProposalDocumentStatus;
  /** `null` only before the first version exists. */
  current_version_id: string | null;
  versions: ProposalVersion[];
  sent_at: string | null;
  sent_by: string | null;
  viewed_at: string | null;
  view_count: number;
  favorited_by_client: boolean;
  revision_requested_at: string | null;
  revision_request_note: string | null;
  /** The Client Portal's own "Accept Placeholder"/"Decline Placeholder" (Step 14) — the client's recorded, non-binding INTENT only. The real, binding `ProposalDraft.status` transition to `"accepted"`/`"rejected"` stays exclusively a staff action via the existing `acceptProposalDraft.ts`/`rejectProposalDraft.ts` (Checkpoint 3/32) — this checkpoint's own stop condition forbids building real e-signature authority for a client's click. */
  clientResponse: "accepted" | "declined" | null;
  clientRespondedAt: string | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProposalVersionInput {
  templateId: string | null;
  templateKey: ProposalTemplateKey | null;
  header: ProposalHeaderContent;
  hero: ProposalHeroContent;
  sections: ProposalSection[];
  packageIds: string[];
  addonIds: string[];
  variables: ProposalVariable[];
  pricingInput: ProposalPricingInput;
  terms: string;
  policies: string;
  footer: ProposalFooterContent;
  notes: string | null;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Step 9 — Proposal Comparison Engine
// ---------------------------------------------------------------------------

export const PROPOSAL_DIFF_CATEGORIES = ["pricing", "sections", "packages", "addons", "variables", "terms", "policies", "images"] as const;
export type ProposalDiffCategory = (typeof PROPOSAL_DIFF_CATEGORIES)[number];

export const PROPOSAL_DIFF_CHANGE_TYPES = ["added", "removed", "changed"] as const;
export type ProposalDiffChangeType = (typeof PROPOSAL_DIFF_CHANGE_TYPES)[number];

export interface ProposalDiffEntry {
  category: ProposalDiffCategory;
  field: string;
  before: string | null;
  after: string | null;
  changeType: ProposalDiffChangeType;
}

export interface ProposalComparisonResult {
  versionANumber: number;
  versionBNumber: number;
  diffs: ProposalDiffEntry[];
  hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Step 10 — Proposal Health Engine
// ---------------------------------------------------------------------------

export const PROPOSAL_HEALTH_CATEGORIES = [
  "completeness",
  "pricing_health",
  "content_health",
  "required_sections",
  "required_pricing",
  "template_health",
  "journey_readiness",
] as const;
export type ProposalHealthCategory = (typeof PROPOSAL_HEALTH_CATEGORIES)[number];

export const PROPOSAL_HEALTH_CATEGORY_LABELS: Record<ProposalHealthCategory, string> = {
  completeness: "Completeness",
  pricing_health: "Pricing Health",
  content_health: "Content Health",
  required_sections: "Required Sections",
  required_pricing: "Required Pricing",
  template_health: "Template Health",
  journey_readiness: "Journey Readiness",
};

/** Same shape as `HealthCategoryScore` (`types/businessHealth.ts`) — a parallel type rather than a reuse, since `HealthCategory` is `businessHealth.ts`'s own closed 11-item union and these 7 categories are Proposal-specific. */
export interface ProposalHealthCategoryScore {
  category: ProposalHealthCategory;
  score: number | null;
  issues: string[];
  notApplicableReason: string | null;
}

export interface ProposalHealth {
  categories: ProposalHealthCategoryScore[];
  overallScore: number;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Step 11 — Proposal Readiness
// ---------------------------------------------------------------------------

export const PROPOSAL_READINESS_STATES = ["ready", "needs_review", "missing_pricing", "missing_client", "missing_package", "missing_sections", "missing_terms", "missing_approval"] as const;
export type ProposalReadinessState = (typeof PROPOSAL_READINESS_STATES)[number];

export const PROPOSAL_READINESS_LABELS: Record<ProposalReadinessState, string> = {
  ready: "Ready",
  needs_review: "Needs Review",
  missing_pricing: "Missing Pricing",
  missing_client: "Missing Client",
  missing_package: "Missing Package",
  missing_sections: "Missing Sections",
  missing_terms: "Missing Terms",
  missing_approval: "Missing Approval",
};

/** `canSend` is the spec's own named "Can Send"/"Cannot Send" — a derived boolean (`state === "ready"`), not an independent 9th/10th readiness state, mirroring how `ExecutionPackage`'s own `PackageReadinessResult` keeps `state`+`reasons` as the one source of truth for any send-gating UI. */
export interface ProposalReadinessResult {
  state: ProposalReadinessState;
  reasons: string[];
  canSend: boolean;
}

// ---------------------------------------------------------------------------
// Step 13 — Proposal Analytics
// ---------------------------------------------------------------------------

/**
 * `acceptanceRate` (decided proposals only: accepted / (accepted+declined))
 * and `conversionRate` (funnel-wide: accepted / total proposals ever
 * created) are two distinct, both-real metrics computed from the same
 * underlying counts — not a fabricated duplicate of one number under two
 * names.
 */
export interface ProposalAnalyticsSnapshot {
  totalProposals: number;
  draftCount: number;
  publishedCount: number;
  sentCount: number;
  viewedCount: number;
  acceptedCount: number;
  declinedCount: number;
  archivedCount: number;
  acceptanceRate: number;
  conversionRate: number;
  averageProposalValue_minor: number;
  averageTimeToAcceptHours: number | null;
  averageRevisionCount: number;
  templateUsage: Record<string, number>;
  packageUsage: Record<string, number>;
  addonUsage: Record<string, number>;
  averageDiscountPercent: number;
  averageDepositPercent: number;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Step 19 — composed read model (never persisted, computed fresh)
// ---------------------------------------------------------------------------

export interface ProposalSummary {
  proposalId: string;
  eventId: string;
  clientId: string;
  documentStatus: ProposalDocumentStatus;
  proposalStatus: ProposalStatus;
  currentVersionNumber: number | null;
  templateKey: ProposalTemplateKey | null;
  grandTotal_minor: number | null;
  currency: string | null;
  overallHealthScore: number;
  readinessState: ProposalReadinessState;
  sentAt: string | null;
  viewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalDetail {
  proposal: ProposalDraft;
  /** `null` until the Builder is opened for the first time and a version is created — evaluating/listing a proposal never materializes an empty shell as a read-time side effect. */
  builderState: ProposalBuilderState | null;
  currentVersion: ProposalVersion | null;
  health: ProposalHealth;
  readiness: ProposalReadinessResult;
}
