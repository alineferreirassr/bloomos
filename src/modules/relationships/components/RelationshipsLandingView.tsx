"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
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
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
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

interface SnapshotStatProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tint: string;
  value: string;
  label: string;
}

/** GLOBAL-VISUAL-02C.1 — one stat block within the single "Relationship
 * Snapshot" card, instead of three disconnected full cards. */
function SnapshotStat({ icon: Icon, tint, value, label }: SnapshotStatProps) {
  return (
    <div className="flex items-center gap-3 py-4 first:pt-0 last:pb-0 sm:px-5 sm:py-1 sm:first:pl-0 sm:last:pr-0">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, ${tint} 16%, var(--luxury-surface))` }}
      >
        <Icon className="h-[18px] w-[18px]" style={{ color: tint }} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-luxury-display text-[1.375rem] leading-none font-semibold text-luxury-text tabular-nums">{value}</p>
        <p className="mt-1 text-luxury-small text-luxury-text-muted">{label}</p>
      </div>
    </div>
  );
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
      <div className="space-y-8">
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
    <div className="space-y-9">
      <PageHeader
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Relationships" }]}
        eyebrow="Relationships"
        title="Relationships"
        heart
        subtitle="The people and conversations that need your attention."
      />

      {/* GLOBAL-VISUAL-03A — rebuilt from the ground up against real AF
          Digital Studio OS screenshots + the current BloomOS Dashboard, not
          an incremental patch of the prior "Relationship Snapshot" card row.
          Pipeline Value now reads as the genuine primary figure (its own
          hero card, largest type on the page after the title) instead of
          sharing equal visual weight with Leads/Clients; those two sit one
          step down in a secondary card; Contracts/Invitations stay a quiet
          inline row. Same five real metrics, same values — presentation
          only. */}
      <div className="space-y-5">
        <SectionHeader title="Relationship overview" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_1fr]">
          <LuxuryCard>
            <div className="flex h-full items-center gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "color-mix(in srgb, var(--luxury-rose) 16%, var(--luxury-surface))" }}
              >
                <TrendingUp className="h-6 w-6" style={{ color: "var(--luxury-rose)" }} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-luxury-display text-[2.125rem] leading-none font-semibold text-luxury-text tabular-nums">
                  {formatMoney(summary.pipelineValue)}
                </p>
                <p className="mt-2 text-luxury-small text-luxury-text-muted">Active Pipeline Value</p>
              </div>
            </div>
          </LuxuryCard>
          <LuxuryCard>
            <div className="grid h-full grid-cols-2 divide-x divide-border/50">
              <SnapshotStat icon={Users} tint="var(--luxury-coral)" value={String(summary.activeLeads.length)} label="Active Leads" />
              <SnapshotStat icon={Users} tint="var(--luxury-success)" value={String(summary.activeClients.length)} label="Active Clients" />
            </div>
          </LuxuryCard>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 px-1 text-luxury-small text-luxury-text-muted">
          <span className="flex items-center gap-1.5">
            <FileSignature className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--luxury-coral)" }} aria-hidden="true" />
            Contracts In Progress <strong className="font-semibold text-luxury-text">{summary.contractsInProgress.length}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--luxury-warning)" }} aria-hidden="true" />
            Pending Invitations <strong className="font-semibold text-luxury-text">{summary.pendingInvitations.length}</strong>
          </span>
        </div>
      </div>

      <div>
        <SectionHeader title="Needs your attention" />
        {attention.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-surface-tint px-5 py-9 text-center text-sm text-text-muted">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            All caught up — nothing in Leads, Contracts, or Invitations needs action right now.
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
