"use client";

import { useEffect, useState } from "react";
import {
  getClientAccountsByClientId,
  getClientInvitations,
  createClientInvitation,
  resendClientInvitation,
  revokeClientInvitation,
  suspendClientAccount,
  reactivateClientAccount,
  revokeClientAccount,
  expireClientInvitations,
} from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { ClientAccount } from "@/types/clientAccount";
import type { ClientInvitation, ClientInvitationWithToken } from "@/types/clientInvitation";
import { CLIENT_ACCOUNT_STATUS_LABELS } from "@/core/enums/clientAccountStatus";
import { INVITATION_STATUS_LABELS } from "@/core/enums/invitationStatus";
import { isClientAccountBlocked } from "@/core/workflows/clientAccountWorkflow";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { NewClientInvitationModal } from "@/modules/clientAccess/components/NewClientInvitationModal";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; accounts: ClientAccount[]; invitations: ClientInvitation[] };

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

interface ClientAccessSectionProps {
  clientId: string;
  clientEmail: string;
}

/**
 * Minimum internal Client Access management UI, embedded on Client Detail —
 * not a redesign of the page, and not the full Client Portal (which remains
 * future scope; see docs/permissions.md). Hidden entirely for a viewer
 * without clients.portal_view, the same "hide the whole card" precedent as
 * the Team Portal dashboard's permission-gated cards.
 */
export function ClientAccessSection({ clientId, clientEmail }: ClientAccessSectionProps) {
  const { can } = useMemberSession();
  const canView = can("clients.portal_view");
  const canInvite = can("clients.portal_invite");
  const canManage = can("clients.portal_manage");
  const canSuspend = can("clients.portal_suspend");
  const canActOnAccounts = canManage || canSuspend;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [modalOpen, setModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<{ email: string; url: string } | null>(null);

  const fetchData = (): Promise<LoadState> =>
    Promise.all([expireClientInvitations().catch(() => undefined), getClientAccountsByClientId(clientId), getClientInvitations({ clientId })])
      .then(([, accounts, invitations]) => ({ status: "ready" as const, accounts, invitations }))
      .catch(() => ({ status: "error" as const }));

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    fetchData().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, canView]);

  if (!canView) return null;

  const refetch = () => fetchData().then(setState);

  const runAction = async (id: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setBusyId(id);
    setActionError(null);
    const result = await action();
    setBusyId(null);
    if (!result.success) {
      setActionError(result.error ?? "That action failed.");
      return;
    }
    refetch();
  };

  return (
    <LuxuryCard>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[17px] font-semibold text-text">Client Portal Access</h3>
        {canInvite ? <Button onClick={() => setModalOpen(true)}>Invite</Button> : null}
      </div>
      <p className="mt-1 text-xs text-text-muted">{getDataPersistenceMessage()}</p>

      {actionError ? (
        <div role="alert" className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {actionError}
        </div>
      ) : null}

      {copiedLink ? (
        <div role="status" className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text">
          Invitation link for {copiedLink.email}: <code className="break-all text-accent">{copiedLink.url}</code>
        </div>
      ) : null}

      {state.status === "loading" ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : state.status === "error" ? (
        <p className="mt-3 text-xs text-text-muted">Could not load Client Portal access.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {state.accounts.length === 0 && state.invitations.length === 0 ? (
            <p className="text-xs text-text-muted">No Client Portal access yet.</p>
          ) : null}

          {state.accounts.length > 0 ? (
            <ul className="space-y-2">
              {state.accounts.map((account) => (
                <li key={account.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
                  <div>
                    <span className="text-text">{account.email}</span>
                    <span className="ml-2 text-text-muted">Last access: {formatDate(account.last_access_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={account.status === "active" ? "accent" : "neutral"}>{CLIENT_ACCOUNT_STATUS_LABELS[account.status]}</Badge>
                    {canActOnAccounts ? (
                      <div className="flex gap-1.5">
                        {account.status === "active" && canSuspend ? (
                          <Button variant="secondary" disabled={busyId === account.id} onClick={() => runAction(account.id, () => suspendClientAccount(account.id))}>
                            Suspend
                          </Button>
                        ) : null}
                        {isClientAccountBlocked(account.status) ? (
                          <Button variant="secondary" disabled={busyId === account.id} onClick={() => runAction(account.id, () => reactivateClientAccount(account.id))}>
                            Reactivate
                          </Button>
                        ) : null}
                        {account.status !== "revoked" && canManage ? (
                          <Button variant="secondary" disabled={busyId === account.id} onClick={() => runAction(account.id, () => revokeClientAccount(account.id))}>
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {state.invitations.length > 0 ? (
            <ul className="space-y-2">
              {state.invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
                  <div>
                    <span className="text-text">{invitation.email}</span>
                    <span className="ml-2 text-text-muted">Expires {formatDate(invitation.expires_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="outline">{INVITATION_STATUS_LABELS[invitation.status]}</Badge>
                    {canInvite && invitation.status === "pending" ? (
                      <div className="flex gap-1.5">
                        <Button
                          variant="secondary"
                          disabled={busyId === invitation.id}
                          onClick={() =>
                            runAction(invitation.id, async () => {
                              const result = await resendClientInvitation(invitation.id);
                              if (result.success) {
                                setCopiedLink({ email: result.data.invitation.email, url: `${window.location.origin}/client-invitations/${result.data.token}` });
                              }
                              return result;
                            })
                          }
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
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <NewClientInvitationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={createClientInvitation}
        onCreated={(result: ClientInvitationWithToken) => {
          setCopiedLink({ email: result.invitation.email, url: `${window.location.origin}/client-invitations/${result.token}` });
          refetch();
        }}
        clientId={clientId}
        defaultEmail={clientEmail}
      />
    </LuxuryCard>
  );
}
