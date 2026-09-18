/**
 * SOCIAL-15D — reporting types over SOCIAL-15B/C's stored attribution
 * (`leads.social_post_id`/`instagram_comment_id`/`instagram_conversation_id`).
 * Every field here is derived from real, already-persisted rows — never
 * inferred from timestamps, usernames, text, or proximity.
 */

/**
 * A Lead's stored attribution, structurally distinguishing the three
 * mutually-non-exclusive-but-never-inferred sources: `social_post_id` is
 * only ever set (SOCIAL-15C) when a comment's `external_media_id` resolved
 * to a real Social Post — a comment-attributed Lead with no resolvable
 * post has `instagram_comment_id` set and `socialPostId: null`, a
 * legitimate partial attribution, never a fabricated post. A
 * conversation-attributed Lead never has a `socialPostId` — DMs are never
 * attributed to a Post by inference (SOCIAL-15C's own explicit rule).
 */
export type LeadAttributionKind = "social_post" | "instagram_comment" | "instagram_conversation" | "none";

export interface SocialPostAttributionStats {
  socialPostId: string;
  /** Unique Leads whose `social_post_id` resolves to this post — never a raw row count across a one-to-many join. */
  leadCount: number;
  /** Unique Clients converted from an attributed Lead (`Client.originating_lead_id` / `Lead.converted_client_id`, the existing, already-real relationship). */
  clientCount: number;
  /** Unique Events booked for an attributed Client (`Event.client_id`) or directly linked to an attributed Lead (`Event.originating_lead_id`), deduped by Event id. */
  eventCount: number;
  /** Sum of `computeClientFinancialSummary(...).invoiced_total_minor` across every unique attributed Client — the existing canonical accrual-revenue figure, unchanged, never recomputed. */
  invoicedRevenueMinor: number;
  /** Sum of `computeClientFinancialSummary(...).collected_minor` across every unique attributed Client — the existing canonical cash-collected figure, unchanged, never recomputed. */
  paidRevenueMinor: number;
}

export interface SocialAttributionTotals {
  /** `leads.social_post_id IS NOT NULL` */
  contentAttributedLeadCount: number;
  /** `leads.instagram_comment_id IS NOT NULL` — includes comment-attributed Leads whose comment never resolved to a Post. */
  commentAttributedLeadCount: number;
  /** `leads.instagram_conversation_id IS NOT NULL` */
  dmAttributedLeadCount: number;
  /** Unique Leads with ANY of the three attribution columns set — never a sum of the three counts above, which can overlap (a comment-attributed Lead is also content-attributed once its post resolves). */
  attributedLeadCount: number;
  /** Leads with none of the three attribution columns set — never retroactively assigned. */
  unattributedLeadCount: number;
  attributedClientCount: number;
  attributedEventCount: number;
  /** All-time, across every attributed Client — matches the Finance Dashboard's own "Total Invoiced"/"Total Collected" cards' all-time convention (`computeAllTimeFinancialTotals`), never a fabricated date-filtered figure. */
  attributedInvoicedRevenueMinor: number;
  attributedPaidRevenueMinor: number;
}

export interface SocialAttributionReport {
  generatedAt: string;
  totals: SocialAttributionTotals;
  /** One entry per Social Post with at least one resolved, attributed Lead. A post with zero attribution simply has no entry here — callers that need an explicit zero row for every post (e.g. Social Analytics' own Post Performance table, which lists every post regardless of engagement) build that by defaulting a missing lookup to zero, never by this report inventing empty rows for posts it has no evidence about. */
  byPost: SocialPostAttributionStats[];
}

/** A single Lead's own stored attribution, resolved for display (Lead/Client/Event Detail) — never an aggregate. */
export interface LeadAttributionDisplay {
  kind: LeadAttributionKind;
  /** Present only when `kind === "social_post"` and the post still exists in this workspace. */
  socialPost: { id: string; caption: string } | null;
  /** Present only when `kind === "instagram_comment"` — id only, never the comment's own raw `content`. */
  comment: { id: string } | null;
  /** Present only when `kind === "instagram_conversation"` — id only, never any message content. */
  conversation: { id: string } | null;
}
