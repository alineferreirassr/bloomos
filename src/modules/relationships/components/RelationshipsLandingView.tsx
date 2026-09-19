"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { TrendingUp, Users, FileSignature, Mail, CheckCircle2 } from "lucide-react";
import { getLeads, getClients, getContracts, getClientInvitations } from "@/lib/data";
import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";
import type { Contract } from "@/types/contract";
import type { ClientInvitation } from "@/types/clientInvitation";
import { LEAD_STATUS_LABELS } from "@/core/enums/leadStatus";
import { getFullName } from "@/lib/personName";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { MetricStat } from "@/components/ui/MetricStat";
import { EditorialSectionHeader } from "@/components/ui/EditorialSectionHeader";
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
      <div className="mx-auto max-w-[1240px] space-y-8">
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
    // GLOBAL-VISUAL-03B.1 — content column capped to Dashboard's own
    // measured 1240px (OwnerDashboardView.tsx: `mx-auto max-w-[1240px]`),
    // restrained instead of stretching the full remaining sidebar width.
    <div className="mx-auto max-w-[1240px] space-y-8">
      <PageHeader
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Relationships" }]}
        eyebrow="Relationships"
        title="Relationships"
        heart
        subtitle="The people and conversations that need your attention."
      />

      {/* GLOBAL-VISUAL-03B.1 — full editorial rebuild, replacing the
          GLOBAL-VISUAL-03A "hero card + secondary card" composition (still
          two bordered/shadowed surfaces stacked, still read as "CARD + CARD").
          Pipeline Value is now bare dominant typography directly on the page
          canvas (no card at all — Dashboard's own measured 40px
          `--luxury-text-display-size`, the exact scale its Revenue Overview
          figure uses) instead of living inside a LuxuryCard; Active Leads/
          Active Clients drop from a bordered+shadowed card to a quiet tinted
          strip (no border, no shadow — one step down, not another card);
          Contracts/Invitations stay plain inline text, unchanged. Same five
          real metrics, same values, same calculations. */}
      <div className="space-y-6">
        <EditorialSectionHeader eyebrow="Relationship overview" title="Your relationships at a glance ♡" />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
          <MetricStat
            size="primary"
            icon={TrendingUp}
            tint="var(--color-accent)"
            value={formatMoney(summary.pipelineValue)}
            label="Active Pipeline Value"
          />
          <div className="grid grid-cols-2 divide-x divide-border/40 rounded-2xl bg-surface-tint">
            <MetricStat icon={Users} tint="var(--color-accent-2)" value={String(summary.activeLeads.length)} label="Active Leads" />
            <MetricStat icon={Users} tint="var(--color-success)" value={String(summary.activeClients.length)} label="Active Clients" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <FileSignature className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent-2)" }} aria-hidden="true" />
            Contracts In Progress <strong className="font-semibold text-text">{summary.contractsInProgress.length}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-warning)" }} aria-hidden="true" />
            Pending Invitations <strong className="font-semibold text-text">{summary.pendingInvitations.length}</strong>
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <EditorialSectionHeader eyebrow="Follow-up" title="Needs your attention" />
        {attention.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-tint px-6 py-12 text-center">
            <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
            <p className="max-w-sm text-sm text-text-muted">
              All caught up — nothing in Leads, Contracts, or Invitations needs action right now.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-surface shadow-luxury-sm">
            <ul className="divide-y divide-border/60">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-accent-100/25"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-text">{item.name}</p>
                      <p className="truncate text-xs text-text-muted">
                        {item.kind} · {item.detail}
                      </p>
                    </div>
                    {item.badge}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
