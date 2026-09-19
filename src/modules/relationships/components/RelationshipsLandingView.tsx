"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TrendingUp, Users, FileSignature, Mail } from "lucide-react";
import { getLeads, getClients, getContracts, getClientInvitations } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";
import type { Contract } from "@/types/contract";
import type { ClientInvitation } from "@/types/clientInvitation";
import { LEAD_STATUS_LABELS } from "@/core/enums/leadStatus";
import { getFullName } from "@/lib/personName";
import { ModuleHero } from "@/components/ui/ModuleHero";
import { ConnectedRail } from "@/components/ui/ConnectedRail";
import { StatusSummary } from "@/components/ui/StatusSummary";
import { SimpleListCard, SimpleListEmpty, RowLink } from "@/components/ui/SimpleListCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { LeadStatusBadge } from "@/modules/leads/components/LeadStatusBadge";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; leads: Lead[]; clients: Client[]; contracts: Contract[]; invitations: ClientInvitation[] };

/** Every Lead status that hasn't reached a terminal outcome yet. */
const ACTIVE_LEAD_STATUSES = new Set([
  "new",
  "contacted",
  "welcome_guide_sent",
  "consultation_scheduled",
  "qualified",
  "proposal_sent",
  "waiting_decision",
]);
/** A Lead sitting with the client, waiting on a reply — the moment follow-up matters most. */
const FOLLOW_UP_LEAD_STATUSES = new Set(["proposal_sent", "waiting_decision"]);
/** A Contract still moving toward signature, not yet at a terminal outcome. */
const IN_PROGRESS_CONTRACT_STATUSES = new Set(["draft", "review", "ready", "sent", "viewed"]);
/** A Contract already in the client's hands, awaiting their signature. */
const AWAITING_SIGNATURE_CONTRACT_STATUSES = new Set(["sent", "viewed"]);

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

interface AttentionItem {
  key: string;
  kind: "Lead" | "Contract" | "Invitation";
  name: string;
  detail: string;
  href: string;
  updated_at: string;
  badge: ReactNode;
}

/**
 * Relationships/CRM landing experience — the AF-inspired "who needs my
 * attention" workspace requested for Relationships Phase 01. Aggregates
 * only real, already-persisted data from the same repositories the Leads/
 * Clients/Contracts/Client Invitations pages already call — no new
 * calculations, no fabricated metrics.
 */
export function RelationshipsLandingView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = (): Promise<LoadState> =>
    Promise.all([getLeads(), getClients(), getContracts(), getClientInvitations()])
      .then(([leads, clients, contracts, invitations]) => ({ status: "ready" as const, leads, clients, contracts, invitations }))
      .catch(() => ({ status: "error" as const }));

  useEffect(() => {
    let cancelled = false;
    fetchData().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = () => {
    setState({ status: "loading" });
    fetchData().then(setState);
  };

  const summary = useMemo(() => {
    if (state.status !== "ready") return null;
    const activeLeads = state.leads.filter((lead) => ACTIVE_LEAD_STATUSES.has(lead.status));
    const activeClients = state.clients.filter((client) => client.internal_status === "active");
    const contractsInProgress = state.contracts.filter((contract) => IN_PROGRESS_CONTRACT_STATUSES.has(contract.status));
    const pendingInvitations = state.invitations.filter((invitation) => invitation.status === "pending");
    const pipelineValue = activeLeads.reduce((sum, lead) => sum + (lead.budget_max ?? lead.budget_min ?? 0), 0);
    return { activeLeads, activeClients, contractsInProgress, pendingInvitations, pipelineValue };
  }, [state]);

  const attention = useMemo<AttentionItem[]>(() => {
    if (state.status !== "ready") return [];
    const clientById = new Map(state.clients.map((client) => [client.id, client]));

    const leadItems: AttentionItem[] = state.leads
      .filter((lead) => FOLLOW_UP_LEAD_STATUSES.has(lead.status))
      .map((lead) => ({
        key: `lead-${lead.id}`,
        kind: "Lead",
        name: getFullName(lead),
        detail: LEAD_STATUS_LABELS[lead.status],
        href: `/leads/${lead.id}`,
        updated_at: lead.updated_at,
        badge: <LeadStatusBadge status={lead.status} />,
      }));

    const contractItems: AttentionItem[] = state.contracts
      .filter((contract) => AWAITING_SIGNATURE_CONTRACT_STATUSES.has(contract.status))
      .map((contract) => {
        const client = clientById.get(contract.client_id);
        return {
          key: `contract-${contract.id}`,
          kind: "Contract",
          name: contract.title,
          detail: client ? getFullName(client) : "Unknown client",
          href: `/contracts/${contract.id}`,
          updated_at: contract.updated_at,
          badge: <ContractStatusBadge status={contract.status} />,
        };
      });

    const invitationItems: AttentionItem[] = state.invitations
      .filter((invitation) => invitation.status === "pending")
      .map((invitation) => {
        const client = clientById.get(invitation.client_id);
        return {
          key: `invitation-${invitation.id}`,
          kind: "Invitation",
          name: client ? getFullName(client) : invitation.email,
          detail: `Expires ${new Date(invitation.expires_at).toLocaleDateString()}`,
          href: "/client-portal/invitations",
          updated_at: invitation.created_at,
          badge: <Badge tone="outline">Pending</Badge>,
        };
      });

    return [...leadItems, ...contractItems, ...invitationItems]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === "error" || !summary) {
    return <ErrorState onRetry={load} />;
  }

  return (
    // GLOBAL-VISUAL-03B.2 — content capped to AF Digital Studio OS's own
    // measured content width (`max-w-6xl`, ContentFrame in
    // src/design-system/patterns/experience.tsx), not BloomOS Dashboard's
    // 1240px — this checkpoint ports AF's real values directly.
    <div className="mx-auto max-w-6xl space-y-8">
      {/* GLOBAL-VISUAL-03B.3 — every real AF ModuleHero call site
          (Notifications/Leads/Pipeline) passes exactly ONE status item, the
          page's single headline figure. Pipeline Value is that figure here —
          same role Pipeline's own hero gives "Leads on the board". */}
      <ModuleHero
        eyebrow="Relationships"
        title="Relationships"
        purpose="The people and conversations that need your attention — every active lead, client, and follow-up in one calm place."
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Relationships" }]}
        status={[{ label: "Active Pipeline Value", value: formatMoney(summary.pipelineValue), icon: TrendingUp }]}
        source={
          <p className="flex items-center gap-1.5 text-xs text-text-muted/80">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            {getDataPersistenceMessage()}
          </p>
        }
      />

      {/* GLOBAL-VISUAL-03B.3 — trimmed to 4 items, matching the exact
          cardinality/shape of AF's own real within-domain rails (Pipeline:
          Leads/Pipeline(current)/Clients/Projects; Leads: Contacts/
          Leads(current)/Pipeline/Clients) rather than listing every sibling
          route. */}
      <section aria-label="Where Relationships sits in your workflow">
        <ConnectedRail
          items={[
            { label: "Leads", href: "/leads" },
            { label: "Relationships", current: true },
            { label: "Clients", href: "/clients" },
            { label: "Contracts", href: "/contracts" },
          ]}
        />
      </section>

      {/* GLOBAL-VISUAL-03B.3 — the prior MetricRail/StatTile card grid is
          removed: verified against every real AF page, `MetricRail`/
          `StatTile` is used exactly once in the whole AF codebase (its own
          Home/`/app` executive summary), never on a CRM inner page — using
          it here mixed two unrelated AF page archetypes into one
          composition that doesn't correspond to any real AF page. The
          remaining figures now render as a second `StatusSummary` row (the
          same real AF component ModuleHero's own status slot uses),
          matching how a genuine AF hub composes secondary figures without a
          card grid. Same four real values, same calculations. */}
      <StatusSummary
        items={[
          { label: "Active Leads", value: summary.activeLeads.length, icon: Users },
          { label: "Active Clients", value: summary.activeClients.length, icon: Users },
          { label: "Contracts In Progress", value: summary.contractsInProgress.length, icon: FileSignature },
          { label: "Pending Invitations", value: summary.pendingInvitations.length, icon: Mail },
        ]}
      />

      {/* GLOBAL-VISUAL-03B.2 — a direct structural port of AF's own
          Workspace "Needs your attention" Card (app/(app)/app/workspace/page.tsx),
          the real component and the real empty-state copy pattern AF uses
          for this exact concept. */}
      <SimpleListCard title="Needs your attention">
        {attention.length === 0 ? (
          <SimpleListEmpty>All caught up — nothing in Leads, Contracts, or Invitations needs action right now.</SimpleListEmpty>
        ) : (
          <div className="space-y-1">
            {attention.map((item) => (
              <RowLink key={item.key} href={item.href} title={item.name} meta={`${item.kind} · ${item.detail}`} trailing={item.badge} />
            ))}
          </div>
        )}
      </SimpleListCard>
    </div>
  );
}
