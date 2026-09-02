"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getClientInvitations, getClients, resendClientInvitation, revokeClientInvitation, expireClientInvitations } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { ClientInvitation } from "@/types/clientInvitation";
import type { InvitationStatus } from "@/core/enums/invitationStatus";
import type { Client } from "@/types/client";
import { INVITATION_STATUSES, INVITATION_STATUS_LABELS } from "@/core/enums/invitationStatus";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getFullName } from "@/lib/personName";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; invitations: ClientInvitation[]; clients: Client[] };

type StatusFilter = "all" | InvitationStatus;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function clientName(client: Client | undefined): string {
  return client ? getFullName(client).trim() : "Unknown client";
}

/**
 * Workspace-wide administration of every Client Portal invitation — the
 * internal-admin counterpart to Team's own Invitations table. Distinct from
 * `ClientAccessSection` (embedded on Client Detail, scoped to one Client at
 * a time, and the only place a *new* invitation is created — this page
 * manages existing invitations only, since resending/revoking need no
 * client context beyond what each row already carries).
 */
export function ClientInvitationsAdminView() {
  const { can } = useMemberSession();
  const canInvite = can("clients.portal_invite");

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<{ email: string; url: string } | null>(null);

  const fetchData = (): Promise<LoadState> =>
    Promise.all([expireClientInvitations().catch(() => undefined), getClientInvitations(), getClients()])
      .then(([, invitations, clients]) => ({ status: "ready" as const, invitations, clients }))
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

  const clientById = useMemo(() => {
    if (state.status !== "ready") return new Map<string, Client>();
    return new Map(state.clients.map((c) => [c.id, c]));
  }, [state]);

  const filtered = useMemo(() => {
    if (state.status !== "ready") return [];
    const query = search.trim().toLowerCase();
    return state.invitations.filter((invitation) => {
      if (statusFilter !== "all" && invitation.status !== statusFilter) return false;
      if (!query) return true;
      const client = clientById.get(invitation.client_id);
      const haystack = `${invitation.email} ${clientName(client)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [state, search, statusFilter, clientById]);

  if (state.status === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState onRetry={load} />;
  }

  const runAction = async (id: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setBusyId(id);
    setActionError(null);
    const result = await action();
    setBusyId(null);
    if (!result.success) {
      setActionError(result.error ?? "That action failed.");
      return;
    }
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Invitations"
        subtitle={`Every Client Portal invitation across the Workspace. ${getDataPersistenceMessage()}`}
      />

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {actionError}
        </div>
      ) : null}

      {copiedLink ? (
        <div role="status" className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text">
          Invitation link for {copiedLink.email}: <code className="break-all text-accent">{copiedLink.url}</code>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-2xl bg-surface/70 p-4">
        <input
          type="search"
          aria-label="Search client invitations"
          placeholder="Search by email or client name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[220px] flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-muted"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text"
        >
          <option value="all">All statuses</option>
          {INVITATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {INVITATION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No invitations found"
          description={state.invitations.length === 0 ? "Invite a client from their Client Detail page to get started." : "Try a different search or filter."}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/70">
                <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Client</th>
                <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Email</th>
                <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Status</th>
                <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Expires</th>
                {canInvite ? <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((invitation) => {
                const client = clientById.get(invitation.client_id);
                return (
                  <tr key={invitation.id} className="transition-colors duration-150 hover:bg-accent-100/25">
                    <td className="px-5 py-4">
                      {client ? (
                        <Link href={`/clients/${client.id}`} className="text-[15px] font-medium text-text hover:text-accent">
                          {clientName(client)}
                        </Link>
                      ) : (
                        <span className="text-text-muted">Unknown client</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-text-muted">{invitation.email}</td>
                    <td className="px-5 py-4">
                      <Badge tone={invitation.status === "pending" ? "outline" : invitation.status === "accepted" ? "success" : "neutral"}>
                        {INVITATION_STATUS_LABELS[invitation.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-text-muted">{formatDate(invitation.expires_at)}</td>
                    {canInvite ? (
                      <td className="px-5 py-4">
                        {invitation.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              disabled={busyId === invitation.id}
                              onClick={async () => {
                                setBusyId(invitation.id);
                                setActionError(null);
                                const result = await resendClientInvitation(invitation.id);
                                setBusyId(null);
                                if (!result.success) {
                                  setActionError(result.error);
                                  return;
                                }
                                setCopiedLink({
                                  email: result.data.invitation.email,
                                  url: `${window.location.origin}/client-invitations/${result.data.token}`,
                                });
                                load();
                              }}
                            >
                              Resend
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={busyId === invitation.id}
                              onClick={() => runAction(invitation.id, () => revokeClientInvitation(invitation.id))}
                            >
                              Revoke
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
