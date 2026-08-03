import { getClients, getEvents, getLeads } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { registerMetric } from "@/core/analytics/metricRegistry";
import { buildMetricResult, filterInWindow, groupByDay, resolveCachedFetch, sumBy } from "@/core/analytics/engine";
import type { MetricComputeContext, MetricComputeResult } from "@/types/analytics";

/**
 * Checkpoint 15 — Clients + Events category metrics. Reuses `getLeads`/
 * `getClients`/`getEvents` and `Lead.converted_client_id` directly, the
 * same real conversion-tracking field the CRM module already relies on —
 * never a separate "was this lead converted" computation. Proposal
 * Acceptance reuses `ProposalsRepository.getRecentProposals` the same way
 * `getBloomAIOverview.ts` already does for its own Usage Statistics.
 */

const newClients = {
  id: "clients.new",
  name: "New Clients",
  description: "Clients recorded within the selected window.",
  category: "clients" as const,
  unit: "count" as const,
  icon: "UserPlus",
  requiredPermissions: ["clients.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const clients = await resolveCachedFetch(context, "clients", () => getClients());
    const dateOf = (client: (typeof clients)[number]) => client.created_at;
    const current = filterInWindow(clients, dateOf, context.window).length;
    const previous = filterInWindow(clients, dateOf, context.previousWindow).length;
    const series = groupByDay(clients, dateOf, () => 1, context.window);
    return buildMetricResult(current, previous, series);
  },
};

const conversionRate = {
  id: "clients.conversionRate",
  name: "Conversion Rate",
  description: "Share of Leads recorded within the window that have since converted to a Client.",
  category: "clients" as const,
  unit: "percent" as const,
  icon: "TrendingUp",
  requiredPermissions: ["leads.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const leads = await resolveCachedFetch(context, "leads", () => getLeads());
    const dateOf = (lead: (typeof leads)[number]) => lead.created_at;

    const rateFor = (window: typeof context.window): number => {
      const cohort = filterInWindow(leads, dateOf, window);
      if (cohort.length === 0) return 0;
      const converted = cohort.filter((lead) => lead.converted_client_id !== null).length;
      return (converted / cohort.length) * 100;
    };

    const current = rateFor(context.window);
    const previous = rateFor(context.previousWindow);
    return buildMetricResult(current, previous);
  },
};

const proposalAcceptance = {
  id: "clients.proposalAcceptance",
  name: "Proposal Acceptance",
  description: "Share of Proposals generated within the window that were accepted.",
  category: "clients" as const,
  unit: "percent" as const,
  icon: "FileCheck",
  requiredPermissions: ["clients.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const proposals = await getProposalsRepository().getRecentProposals(context.workspaceId, 10000);
    const dateOf = (proposal: (typeof proposals)[number]) => proposal.created_at;

    const rateFor = (window: typeof context.window): number => {
      const cohort = filterInWindow(proposals, dateOf, window).filter((proposal) => proposal.status === "accepted" || proposal.status === "rejected");
      if (cohort.length === 0) return 0;
      const accepted = cohort.filter((proposal) => proposal.status === "accepted").length;
      return (accepted / cohort.length) * 100;
    };

    return buildMetricResult(rateFor(context.window), rateFor(context.previousWindow));
  },
};

const eventsBooked = {
  id: "events.booked",
  name: "Events Booked",
  description: "Events recorded within the selected window.",
  category: "events" as const,
  unit: "count" as const,
  icon: "CalendarPlus",
  requiredPermissions: ["events.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const events = await resolveCachedFetch(context, "events", () => getEvents());
    const dateOf = (event: (typeof events)[number]) => event.created_at;
    const current = filterInWindow(events, dateOf, context.window).length;
    const previous = filterInWindow(events, dateOf, context.previousWindow).length;
    const series = groupByDay(events, dateOf, () => 1, context.window);
    return buildMetricResult(current, previous, series);
  },
};

const eventsUpcoming = {
  id: "events.upcoming",
  name: "Upcoming Events",
  description: "Events scheduled within the selected window's own duration, starting now.",
  category: "events" as const,
  unit: "count" as const,
  icon: "CalendarClock",
  requiredPermissions: ["events.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const events = await resolveCachedFetch(context, "events", () => getEvents());
    const horizonMs = new Date(context.window.end).getTime() - new Date(context.window.start).getTime();
    const now = new Date(context.window.end);
    const forwardWindow = { start: now.toISOString(), end: new Date(now.getTime() + horizonMs).toISOString() };
    const dated = events.filter((event) => event.event_date !== null);
    const current = sumBy(filterInWindow(dated, (event) => event.event_date as string, forwardWindow), () => 1);
    return buildMetricResult(current, null);
  },
};

let registered = false;

export function registerClientMetrics(): void {
  if (registered) return;
  registerMetric(newClients);
  registerMetric(conversionRate);
  registerMetric(proposalAcceptance);
  registerMetric(eventsBooked);
  registerMetric(eventsUpcoming);
  registered = true;
}
