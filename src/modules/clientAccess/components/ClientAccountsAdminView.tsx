"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getClientAccounts, getClients, suspendClientAccount, reactivateClientAccount, revokeClientAccount } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { ClientAccount } from "@/types/clientAccount";
import type { ClientAccountStatus } from "@/core/enums/clientAccountStatus";
import type { Client } from "@/types/client";
import { CLIENT_ACCOUNT_STATUSES, CLIENT_ACCOUNT_STATUS_LABELS } from "@/core/enums/clientAccountStatus";
import { isClientAccountBlocked } from "@/core/workflows/clientAccountWorkflow";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { Card } from "@/components/ui/Card";
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
  | { status: "ready"; accounts: ClientAccount[]; clients: Client[] };

type StatusFilter = "all" | ClientAccountStatus;

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

function clientName(client: Client | undefined): string {
  return client ? getFullName(client).trim() : "Unknown client";
}

/**
 * Workspace-wide administration of every Client Portal account — the
 * internal-admin counterpart to Team's own Members list. Distinct from
 * `ClientAccessSection` (embedded on Client Detail, scoped to one Client at
 * a time): this page lists every account across the whole Workspace, same
 * "cross-record admin view" precedent as `TeamView`'s Members table.
 */
export function ClientAccountsAdminView() {
  const { can } = useMemberSession();
  const canManage = can("clients.portal_manage");
  const canSuspend = can("clients.portal_suspend");
  const canActOnAccounts = canManage || canSuspend;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchData = (): Promise<LoadState> =>
    Promise.all([getClientAccounts(), getClients()])
      .then(([accounts, clients]) => ({ status: "ready" as const, accounts, clients }))
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
    return state.accounts.filter((account) => {
      if (statusFilter !== "all" && account.status !== statusFilter) return false;
      if (!query) return true;
      const client = clientById.get(account.client_id);
      const haystack = `${account.email} ${clientName(client)}`.toLowerCase();
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
        title="Client Accounts"
        subtitle={`Every Client Portal account across the Workspace. ${getDataPersistenceMessage()}`}
      />

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {actionError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          aria-label="Search client accounts"
          placeholder="Search by email or client name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[220px] flex-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-text placeholder:text-text-muted"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
        >
          <option value="all">All statuses</option>
          {CLIENT_ACCOUNT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CLIENT_ACCOUNT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title="No client accounts found"
            description={state.accounts.length === 0 ? "Invite a client from their Client Detail page to get started." : "Try a different search or filter."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Client</th>
                  <th className="pb-2 pr-3 font-normal">Email</th>
                  <th className="pb-2 pr-3 font-normal">Status</th>
                  <th className="pb-2 pr-3 font-normal">Last access</th>
                  {canActOnAccounts ? <th className="pb-2 font-normal">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((account) => {
                  const client = clientById.get(account.client_id);
                  return (
                    <tr key={account.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">
                        {client ? (
                          <Link href={`/clients/${client.id}`} className="text-accent hover:underline">
                            {clientName(client)}
                          </Link>
                        ) : (
                          <span className="text-text-muted">Unknown client</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-text-muted">{account.email}</td>
                      <td className="py-2 pr-3">
                        <Badge tone={account.status === "active" ? "accent" : "neutral"}>
                          {CLIENT_ACCOUNT_STATUS_LABELS[account.status]}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-text-muted">{formatDate(account.last_access_at)}</td>
                      {canActOnAccounts ? (
                        <td className="py-2">
                          <div className="flex gap-2">
                            {account.status === "active" && canSuspend ? (
                              <Button
                                variant="secondary"
                                disabled={busyId === account.id}
                                onClick={() => runAction(account.id, () => suspendClientAccount(account.id))}
                              >
                                Suspend
                              </Button>
                            ) : null}
                            {isClientAccountBlocked(account.status) ? (
                              <Button
                                variant="secondary"
                                disabled={busyId === account.id}
                                onClick={() => runAction(account.id, () => reactivateClientAccount(account.id))}
                              >
                                Reactivate
                              </Button>
                            ) : null}
                            {account.status !== "revoked" && canManage ? (
                              <Button
                                variant="secondary"
                                disabled={busyId === account.id}
                                onClick={() => runAction(account.id, () => revokeClientAccount(account.id))}
                              >
                                Revoke
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
