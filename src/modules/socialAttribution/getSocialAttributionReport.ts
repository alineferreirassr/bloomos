import { getLeads, getClients, getEvents, getInvoices, getPayments } from "@/lib/data";
import { computeClientFinancialSummary } from "@/modules/finance/financialSummary";
import { clockNow } from "@/core/time/clock";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";
import type { Lead } from "@/types/lead";
import type { SocialAttributionReport, SocialAttributionTotals, SocialPostAttributionStats } from "@/modules/socialAttribution/types";

/**
 * SOCIAL-15D — the single reporting rollup over SOCIAL-15B/C's stored
 * attribution, reused by every surface that needs aggregate numbers
 * (Social Analytics' Post Performance table, Social Strategist's
 * Conversion card, Finance Dashboard's attribution metrics) rather than
 * each surface computing its own.
 *
 * Reuses the exact, unchanged `computeClientFinancialSummary` for every
 * revenue figure (SOCIAL-15A's own audit found no multi-entity aggregate
 * helper anywhere in this codebase; the established pattern — see
 * `getClientFinancialSummary`/`getContractFinanceSummary` in
 * `lib/data/index.ts` — is to fetch the full workspace-scoped arrays once
 * and let the pure `compute*` function do the id-filtering) — this module
 * follows that exact idiom, never recomputes invoiced/collected math
 * itself. `contracts`/`expenses` are deliberately passed as `[]`: this
 * report only ever reads `invoiced_total_minor`/`collected_minor` (both
 * derived purely from `invoices`/`payments`, confirmed independent of the
 * contracts/expenses parameters) — it never reads `gross_profit_minor`/
 * `expense_total_minor`/margin fields, so no incomplete-expense-data
 * ambiguity is ever surfaced. Expenses can be Event-, Client-, or
 * company-scoped in this schema (not Event-only, as a stricter premise
 * might assume) — this checkpoint's own authorization explicitly prefers
 * reporting invoiced/paid revenue over inventing an "attributed profit"
 * figure precisely because of that ambiguity, so profit/expense fields
 * are never read here at all.
 *
 * Double-counting safety: `clients.originating_lead_id` is UNIQUE (one
 * Client has at most one originating Lead), so summing revenue per unique
 * attributed Client id, once per id, can never double-count — a Client
 * can never be reached by two different attributed Leads. `byPost` groups
 * strictly by `lead.social_post_id`, and since that column is a single
 * nullable FK (never an array), a Lead can belong to at most one post's
 * own bucket — summing `byPost[*].invoicedRevenueMinor` across every post
 * therefore never exceeds `totals.attributedInvoicedRevenueMinor`.
 */
export async function getSocialAttributionReport(context?: ServerRepositoryContext): Promise<SocialAttributionReport> {
  const [leads, clients, events, invoices, payments] = await Promise.all([
    getLeads({ includeArchived: true }, context),
    getClients({ includeArchived: true }, context),
    getEvents({ includeArchived: true }, context),
    getInvoices({ includeArchived: true }, context),
    getPayments({}, context),
  ]);

  const clientById = new Map(clients.map((client) => [client.id, client]));

  const contentAttributed = leads.filter((lead) => lead.social_post_id);
  const commentAttributed = leads.filter((lead) => lead.instagram_comment_id);
  const dmAttributed = leads.filter((lead) => lead.instagram_conversation_id);
  const anyAttributed = leads.filter((lead) => lead.social_post_id || lead.instagram_comment_id || lead.instagram_conversation_id);
  const unattributed = leads.filter((lead) => !lead.social_post_id && !lead.instagram_comment_id && !lead.instagram_conversation_id);

  function revenueForClientIds(clientIds: Set<string>): { invoicedRevenueMinor: number; paidRevenueMinor: number } {
    let invoicedRevenueMinor = 0;
    let paidRevenueMinor = 0;
    for (const clientId of clientIds) {
      const summary = computeClientFinancialSummary(clientId, [], invoices, payments, []);
      invoicedRevenueMinor += summary.invoiced_total_minor;
      paidRevenueMinor += summary.collected_minor;
    }
    return { invoicedRevenueMinor, paidRevenueMinor };
  }

  /** Every Event whose Client is one of `clientIds`, plus any Event directly linked via `originating_lead_id` to one of `leadIds` — deduped by Event id (a plain array filter over a single pass, never a join that could produce duplicate rows). */
  function eventIdsForAttribution(clientIds: Set<string>, leadIds: Set<string>): Set<string> {
    const ids = new Set<string>();
    for (const event of events) {
      if (clientIds.has(event.client_id) || (event.originating_lead_id && leadIds.has(event.originating_lead_id))) {
        ids.add(event.id);
      }
    }
    return ids;
  }

  function clientIdsForLeads(attributedLeads: Lead[]): Set<string> {
    const ids = new Set<string>();
    for (const lead of attributedLeads) {
      if (lead.converted_client_id && clientById.has(lead.converted_client_id)) ids.add(lead.converted_client_id);
    }
    return ids;
  }

  const attributedClientIds = clientIdsForLeads(anyAttributed);
  const attributedLeadIds = new Set(anyAttributed.map((lead) => lead.id));
  const attributedEventIds = eventIdsForAttribution(attributedClientIds, attributedLeadIds);
  const totalRevenue = revenueForClientIds(attributedClientIds);

  const totals: SocialAttributionTotals = {
    contentAttributedLeadCount: contentAttributed.length,
    commentAttributedLeadCount: commentAttributed.length,
    dmAttributedLeadCount: dmAttributed.length,
    attributedLeadCount: anyAttributed.length,
    unattributedLeadCount: unattributed.length,
    attributedClientCount: attributedClientIds.size,
    attributedEventCount: attributedEventIds.size,
    attributedInvoicedRevenueMinor: totalRevenue.invoicedRevenueMinor,
    attributedPaidRevenueMinor: totalRevenue.paidRevenueMinor,
  };

  const leadsByPost = new Map<string, Lead[]>();
  for (const lead of contentAttributed) {
    const postId = lead.social_post_id;
    if (!postId) continue;
    const existing = leadsByPost.get(postId);
    if (existing) existing.push(lead);
    else leadsByPost.set(postId, [lead]);
  }

  const byPost: SocialPostAttributionStats[] = [];
  for (const [socialPostId, postLeads] of leadsByPost) {
    const postLeadIds = new Set(postLeads.map((lead) => lead.id));
    const postClientIds = clientIdsForLeads(postLeads);
    const postEventIds = eventIdsForAttribution(postClientIds, postLeadIds);
    const postRevenue = revenueForClientIds(postClientIds);

    byPost.push({
      socialPostId,
      leadCount: postLeadIds.size,
      clientCount: postClientIds.size,
      eventCount: postEventIds.size,
      invoicedRevenueMinor: postRevenue.invoicedRevenueMinor,
      paidRevenueMinor: postRevenue.paidRevenueMinor,
    });
  }

  return {
    generatedAt: clockNow().toISOString(),
    totals,
    byPost,
  };
}
