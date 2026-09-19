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
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ModuleHero } from "@/components/ui/ModuleHero";
import { ConnectedRail } from "@/components/ui/ConnectedRail";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
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
      <div className="mx-auto max-w-6xl space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorState onRetry={load} />
      </div>
    );
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
    // GLOBAL-VISUAL-04 — same AF-ported dense-list shell as Leads/
    // Contracts (ModuleHero compact, matching AF's own Leads/Contacts
    // real pattern; no direct AF equivalent page for account admin,
    // closest documented pattern used per section 14's instruction).
    <div className="mx-auto max-w-6xl space-y-6">
      <ModuleHero
        compact
        eyebrow="Client Accounts"
        title="Client Accounts"
        purpose="Every Client Portal account across the Workspace."
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Relationships", href: "/relationships" }, { label: "Client Accounts" }]}
        source={
          <p className="flex items-center gap-1.5 text-xs text-text-muted/80">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            {getDataPersistenceMessage()}
          </p>
        }
      />

      <section aria-label="Where Client Accounts sits in your workflow">
        <ConnectedRail
          items={[
            { label: "Relationships", href: "/relationships" },
            { label: "Clients", href: "/clients" },
            { label: "Client Accounts", current: true },
            { label: "Client Invitations", href: "/client-portal/invitations" },
          ]}
        />
      </section>

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {actionError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-2xl border border-border/50 bg-surface/70 p-5">
        <Input
          type="search"
          aria-label="Search client accounts"
          placeholder="Search by email or client name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[220px] flex-1"
        />
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="w-auto"
        >
          <option value="all">All statuses</option>
          {CLIENT_ACCOUNT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CLIENT_ACCOUNT_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No client accounts found"
          description={state.accounts.length === 0 ? "Invite a client from their Client Detail page to get started." : "Try a different search or filter."}
        />
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Client</TableHeaderCell>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Last access</TableHeaderCell>
              {canActOnAccounts ? <TableHeaderCell>Actions</TableHeaderCell> : null}
            </tr>
          </TableHead>
          <TableBody>
            {filtered.map((account) => {
              const client = clientById.get(account.client_id);
              return (
                <TableRow key={account.id}>
                  <TableCell>
                    {client ? (
                      <Link href={`/clients/${client.id}`} className="text-[15px] font-medium text-text hover:text-accent">
                        {clientName(client)}
                      </Link>
                    ) : (
                      <span className="text-text-muted">Unknown client</span>
                    )}
                  </TableCell>
                  <TableCell className="text-text-muted">{account.email}</TableCell>
                  <TableCell>
                    <Badge tone={account.status === "active" ? "success" : "neutral"}>
                      {CLIENT_ACCOUNT_STATUS_LABELS[account.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-muted">{formatDate(account.last_access_at)}</TableCell>
                  {canActOnAccounts ? (
                    <TableCell>
                      <div className="flex gap-2">
                        {account.status === "active" && canSuspend ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === account.id}
                            onClick={() => runAction(account.id, () => suspendClientAccount(account.id))}
                          >
                            Suspend
                          </Button>
                        ) : null}
                        {isClientAccountBlocked(account.status) ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === account.id}
                            onClick={() => runAction(account.id, () => reactivateClientAccount(account.id))}
                          >
                            Reactivate
                          </Button>
                        ) : null}
                        {account.status !== "revoked" && canManage ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === account.id}
                            onClick={() => runAction(account.id, () => revokeClientAccount(account.id))}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
