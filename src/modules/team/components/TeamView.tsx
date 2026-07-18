"use client";

import { useEffect, useState } from "react";
import {
  getWorkspaceMembers,
  updateWorkspaceMemberRole,
  deactivateWorkspaceMember,
  reactivateWorkspaceMember,
  removeWorkspaceMember,
  getWorkspaceInvitations,
  createWorkspaceInvitation,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  expireWorkspaceInvitations,
} from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { TeamMember } from "@/types/teamMember";
import type { WorkspaceInvitation } from "@/types/workspaceInvitation";
import { WORKSPACE_MEMBER_ROLES, WORKSPACE_MEMBER_ROLE_LABELS, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import { INVITATION_STATUS_LABELS } from "@/core/enums/invitationStatus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { NewInvitationModal } from "@/modules/team/components/NewInvitationModal";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      members: TeamMember[];
      invitations: WorkspaceInvitation[];
    };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function TeamView() {
  const { can } = useMemberSession();
  const canManageRoles = can("team.manage_roles");
  const canInvite = can("team.invite");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [newInvitationOpen, setNewInvitationOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<{ email: string; url: string } | null>(null);

  // The member's own role/permissions come from MemberSessionProvider (server-seeded,
  // see (app)/layout.tsx) — this only fetches the roster/invitations themselves.
  const fetchTeamData = (): Promise<LoadState> =>
    Promise.all([expireWorkspaceInvitations().catch(() => undefined), getWorkspaceMembers(), getWorkspaceInvitations()])
      .then(([, members, invitations]) => ({ status: "ready" as const, members, invitations }))
      .catch(() => ({ status: "error" as const }));

  useEffect(() => {
    let cancelled = false;
    fetchTeamData().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = () => {
    setState({ status: "loading" });
    fetchTeamData().then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState onRetry={load} />;
  }

  const { members, invitations } = state;

  const runAction = async (id: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setBusyId(id);
    setActionError(null);
    const result = await action();
    setBusyId(null);
    if (!result.success) {
      setActionError(result.error ?? "Something went wrong.");
      return;
    }
    load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">Team</h2>
        <p className="mt-1 text-sm text-text-muted">Amoré Bloom&apos;s internal team members and invitations. {getDataPersistenceMessage()}</p>
      </div>

      {actionError ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {actionError}
        </div>
      ) : null}

      {copiedLink ? (
        <div role="status" className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text">
          Invitation link for {copiedLink.email}:{" "}
          <code className="break-all text-accent">{copiedLink.url}</code>
        </div>
      ) : null}

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Members</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="pb-2 pr-3 font-normal">Name</th>
                <th className="pb-2 pr-3 font-normal">Email</th>
                <th className="pb-2 pr-3 font-normal">Role</th>
                <th className="pb-2 pr-3 font-normal">Status</th>
                <th className="pb-2 pr-3 font-normal">Joined</th>
                {canManageRoles ? <th className="pb-2 font-normal">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 text-text">{member.full_name ?? "—"}</td>
                  <td className="py-2 pr-3 text-text-muted">{member.email}</td>
                  <td className="py-2 pr-3">
                    {canManageRoles ? (
                      <select
                        aria-label={`Role for ${member.email}`}
                        value={member.role}
                        disabled={busyId === member.id}
                        onChange={(event) =>
                          runAction(member.id, () => updateWorkspaceMemberRole(member.id, event.target.value as WorkspaceMemberRole))
                        }
                        className="rounded-md border border-border bg-transparent px-1.5 py-1 text-xs text-text"
                      >
                        {WORKSPACE_MEMBER_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {WORKSPACE_MEMBER_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone="outline">{WORKSPACE_MEMBER_ROLE_LABELS[member.role]}</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={member.status === "active" ? "accent" : "neutral"}>
                      {member.status === "active" ? "Active" : "Suspended"}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-text-muted">{formatDate(member.created_at)}</td>
                  {canManageRoles ? (
                    <td className="py-2">
                      <div className="flex gap-2">
                        {member.status === "active" ? (
                          <Button
                            variant="secondary"
                            disabled={busyId === member.id}
                            onClick={() => runAction(member.id, () => deactivateWorkspaceMember(member.id))}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={busyId === member.id}
                            onClick={() => runAction(member.id, () => reactivateWorkspaceMember(member.id))}
                          >
                            Reactivate
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          disabled={busyId === member.id}
                          onClick={() => runAction(member.id, () => removeWorkspaceMember(member.id))}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-[17px] font-semibold text-text">Invitations</h3>
          {canInvite ? <Button onClick={() => setNewInvitationOpen(true)}>New Invitation</Button> : null}
        </div>

        {invitations.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No invitations yet" description={canInvite ? "Invite a team member to get started." : undefined} />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Email</th>
                  <th className="pb-2 pr-3 font-normal">Role</th>
                  <th className="pb-2 pr-3 font-normal">Status</th>
                  <th className="pb-2 pr-3 font-normal">Expires</th>
                  {canInvite ? <th className="pb-2 font-normal">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">{invitation.email}</td>
                    <td className="py-2 pr-3 text-text-muted">{WORKSPACE_MEMBER_ROLE_LABELS[invitation.invited_role]}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={invitation.status === "pending" ? "outline" : invitation.status === "accepted" ? "accent" : "neutral"}>
                        {INVITATION_STATUS_LABELS[invitation.status]}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{formatDate(invitation.expires_at)}</td>
                    {canInvite ? (
                      <td className="py-2">
                        {invitation.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              disabled={busyId === invitation.id}
                              onClick={async () => {
                                setBusyId(invitation.id);
                                setActionError(null);
                                const result = await resendWorkspaceInvitation(invitation.id);
                                setBusyId(null);
                                if (!result.success) {
                                  setActionError(result.error);
                                  return;
                                }
                                setCopiedLink({ email: result.data.invitation.email, url: `${window.location.origin}/invitations/${result.data.token}` });
                                load();
                              }}
                            >
                              Resend
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={busyId === invitation.id}
                              onClick={() => runAction(invitation.id, () => revokeWorkspaceInvitation(invitation.id))}
                            >
                              Revoke
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewInvitationModal
        open={newInvitationOpen}
        onClose={() => setNewInvitationOpen(false)}
        onCreate={createWorkspaceInvitation}
        onCreated={(result) => {
          setCopiedLink({ email: result.invitation.email, url: `${window.location.origin}/invitations/${result.token}` });
          load();
        }}
      />
    </div>
  );
}
