/**
 * A generated proposal is a draft until a human explicitly accepts it —
 * `"draft"` covers every generation (first and every regeneration);
 * `"superseded"` is assigned automatically to the prior version the moment
 * a newer one is generated for the same Event, mirroring Document's
 * version-chain behavior (`is_latest_version` there, `status` here since a
 * Proposal has no separate latest-flag field). Nothing transitions to
 * `"accepted"`/`"rejected"` except an explicit human action — never the AI.
 */
export type ProposalStatus = "draft" | "accepted" | "rejected" | "superseded";

/** One line of "Services Included" or "Optional Add-ons" — always resolved from a real EventService assignment, never invented by the model. */
export interface ProposalLineItem {
  /** The EventService assignment id this line item resolves to — lets validation reject a model-invented service reference. */
  event_service_id: string;
  label: string;
  description: string | null;
  price_minor: number;
  currency: string;
  is_optional_add_on: boolean;
}

/** One row of a payment schedule the model proposes — always validated against the Contract's own deposit/remaining-balance scalars when a Contract exists, never invented pricing. */
export interface ProposalPaymentScheduleLine {
  label: string;
  amount_minor: number;
  /** ISO date, or `null` for a schedule point like "on booking" that isn't yet a fixed date. */
  due_date: string | null;
  description: string | null;
}

export interface ProposalPricingSummary {
  subtotal_minor: number;
  currency: string;
}

/**
 * The persisted result of one AI Proposal Generator run — a draft is
 * ephemeral in the sense that only a human's explicit accept/reject
 * changes its status, but the record itself is real and survives a page
 * reload (mock-only persistence this phase, same precedent as
 * `core/tags`/`core/aiMemory`/every other mock-first Core domain).
 */
export interface ProposalDraft {
  id: string;
  workspace_id: string;
  event_id: string;
  client_id: string;
  status: ProposalStatus;
  /** 1 for the first generation; each Regenerate increments and supersedes the prior version, same chain shape as `Document.version`. */
  version: number;
  parent_proposal_id: string | null;

  executive_summary: string;
  event_overview: string;
  services_included: ProposalLineItem[];
  timeline_summary: string;
  pricing_summary: ProposalPricingSummary;
  payment_terms: ProposalPaymentScheduleLine[];
  recommendations: string[];
  optional_add_ons: ProposalLineItem[];
  questions_for_client: string[];
  /** 0–100, derived from context completeness — never the model's own self-reported confidence, same rule as `ContextConfidence` in the Event Operations Brief. */
  ai_confidence: number;
  missing_information: string[];

  provider: string;
  model: string;
  prompt_version: string;
  mock: boolean;
  /** The AI Runtime's own measured latency for this generation (`AIRuntimeExecutionMetadata.latencyMs`) — surfaced in the UI's generation metadata alongside provider/prompt version/draft version. */
  generation_latency_ms: number;
  generated_at: string;

  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProposalDraftInput {
  event_id: string;
  client_id: string;
  parent_proposal_id: string | null;
  executive_summary: string;
  event_overview: string;
  services_included: ProposalLineItem[];
  timeline_summary: string;
  pricing_summary: ProposalPricingSummary;
  payment_terms: ProposalPaymentScheduleLine[];
  recommendations: string[];
  optional_add_ons: ProposalLineItem[];
  questions_for_client: string[];
  ai_confidence: number;
  missing_information: string[];
  provider: string;
  model: string;
  prompt_version: string;
  mock: boolean;
  generation_latency_ms: number;
  generated_at: string;
}
