"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { listTeamRoleLabelsAction, setTeamRoleLabelAction } from "@/modules/dashboard/teamRoleLabelActions";
import type { TeamMember } from "@/types/teamMember";
import type { WorkspaceInvitation } from "@/types/workspaceInvitation";
import { TEAM_ROLE_LABELS, TEAM_ROLE_LABEL_NAMES, DEFAULT_TEAM_ROLE_LABEL, type TeamRoleLabel } from "@/types/teamRoleLabel";
import { WORKSPACE_MEMBER_ROLES, WORKSPACE_MEMBER_ROLE_LABELS, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import { INVITATION_STATUS_LABELS } from "@/core/enums/invitationStatus";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { LuxuryBranding } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";
import { LuxuryDashboardShell } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";
import { PersonalizedWelcomeHeader } from "@/modules/dashboard/luxury/components/PersonalizedWelcomeHeader";
import { DashboardDateSelector } from "@/modules/dashboard/luxury/components/DashboardDateSelector";
import { ProfileMenu } from "@/modules/dashboard/luxury/components/ProfileMenu";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { LuxuryMetricCard, type LuxuryMetricCardData } from "@/modules/dashboard/luxury/components/LuxuryMetricCard";
import { CompactClockWeatherPanel } from "@/modules/dashboard/luxury/components/CompactClockWeatherPanel";
import { LittleReminderCard } from "@/modules/dashboard/luxury/components/LittleReminderCard";
import { TodaysPriorityCard } from "@/modules/dashboard/luxury/components/TodaysPriorityCard";
import { TodaysTimelineCard } from "@/modules/dashboard/luxury/components/TodaysTimelineCard";
import { TodaysPulseCard } from "@/modules/dashboard/luxury/components/TodaysPulseCard";
import { EventPreviewCard } from "@/modules/dashboard/luxury/components/EventPreviewCard";
import { DEFAULT_OPERATIONAL_LOCATION } from "@/core/dashboard/operationalLocation";
import type { DailyForecast } from "@/types/weather";
import type { TodaysPriorityData } from "@/modules/dashboard/luxury/components/TodaysPriorityCard";
import type { LittleReminderData } from "@/modules/dashboard/luxury/components/LittleReminderCard";
import type { ScheduleTimelineItemData } from "@/modules/dashboard/luxury/components/ScheduleTimeline";
import type { TodaysPulseMetric } from "@/modules/dashboard/luxury/components/TodaysPulseCard";
import type { EventPreviewCardData } from "@/modules/dashboard/luxury/components/EventPreviewCard";
import { NewInvitationModal } from "@/modules/team/components/NewInvitationModal";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      members: TeamMember[];
      invitations: WorkspaceInvitation[];
      teamRoleLabels: Record<string, TeamRoleLabel>;
    };

interface TeamViewProps {
  branding: LuxuryBranding;
  profileName: string;
  profileRoleLabel: string;
  profileAvatarUrl: string | null;
  operationalForecast: DailyForecast | null;
  littleReminder: LittleReminderData | null;
  todaysPriority: TodaysPriorityData | null;
  upcomingEvents: EventPreviewCardData[];
  todaysTimeline: ScheduleTimelineItemData[];
  todaysPulse: TodaysPulseMetric[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/**
 * "Team page must use the same dashboard system" addendum, then the "Team +
 * Client Compact Clock & Weather Variant" correction, then the "Daily
 * Experience — Staging Correction + Copy Refinement" checkpoint — `/team`
 * shares the Luxury Dashboard shell and card system `/dashboard` uses. This
 * IS the real acceptance route the Founder inspects on staging — it is a
 * separate component tree from `TeamDashboardView.tsx` (which only renders
 * inside `/dashboard` for manager/staff roles), so both must independently
 * carry the same AF-Inspired "Today, at a Glance" composition. Its "Today"
 * section is the COMPACT single-location `CompactClockWeatherPanel` (one
 * Huntington Beach clock + that location's weather), not Founder's
 * multi-city `WorldClockCard`. Directly below: Today's Priority (the single
 * most urgent workspace-wide item, re-skinned from the same checklist data
 * the old full-list "Today's Focus" card showed) beside `LittleReminderCard`
 * (the viewer's own real latest unread notification), then Upcoming Events
 * (the same workspace-wide upcoming events this page already established as
 * "every role sees the same data" precedent for Weather), then Today's
 * Timeline beside Today's Pulse. No Calendar DASHBOARD WIDGET renders on
 * this page — `/calendar` itself, its data, and its permissions are
 * completely untouched; Today's Timeline's own footer links to it instead.
 * `operationalForecast`/`littleReminder`/`todaysPriority`/`upcomingEvents`/
 * `todaysTimeline`/`todaysPulse` come from `getTeamPageGlanceData` — a
 * role-agnostic sibling of `getOwnerDashboardData` built on the same
 * `events.view`-checked, workspace-wide data that action already exposes,
 * plus a fixed, non-event location forecast, so every role that can already
 * reach this page sees the same data, never anything RLS/permissions
 * wouldn't already let them see elsewhere — and never the Founder-private
 * wellness/notes data that stays exclusive to the personal Dashboard. The
 * roster/invitations management below (members table, role dropdowns,
 * invite modal) is unchanged in behavior — only its presentation now sits
 * inside `LuxuryCard`s instead of the old generic `Card`.
 */
export function TeamView({ branding, profileName, profileRoleLabel, profileAvatarUrl, operationalForecast, littleReminder, todaysPriority, upcomingEvents, todaysTimeline, todaysPulse }: TeamViewProps) {
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
    Promise.all([expireWorkspaceInvitations().catch(() => undefined), getWorkspaceMembers(), getWorkspaceInvitations(), listTeamRoleLabelsAction()])
      .then(([, members, invitations, labelsResult]) => ({
        status: "ready" as const,
        members,
        invitations,
        teamRoleLabels: labelsResult.success ? labelsResult.data : {},
      }))
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

  const kpis =
    state.status === "ready"
      ? {
          total: state.members.length,
          owner: state.members.filter((member) => member.role === "owner").length,
          admin: state.members.filter((member) => member.role === "admin").length,
          manager: state.members.filter((member) => member.role === "manager").length,
          staff: state.members.filter((member) => member.role === "staff").length,
        }
      : null;

  const metrics: LuxuryMetricCardData[] = kpis
    ? [
        { id: "total-members", label: "Total Members", value: kpis.total.toLocaleString(), icon: "Users" },
        { id: "owner", label: "Owner", value: kpis.owner.toLocaleString(), icon: "Users" },
        { id: "admin", label: "Admin", value: kpis.admin.toLocaleString(), icon: "Users" },
        { id: "manager", label: "Manager", value: kpis.manager.toLocaleString(), icon: "Users" },
        { id: "staff", label: "Staff", value: kpis.staff.toLocaleString(), icon: "Users" },
      ]
    : [];

  return (
    <LuxuryDashboardShell
      branding={branding}
      sidebarFooter={<ProfileMenu name={profileName} roleLabel={profileRoleLabel} avatarUrl={profileAvatarUrl} />}
      topbarActions={<DashboardDateSelector />}
    >
      <div className="space-y-6">
        <PersonalizedWelcomeHeader copy={{ greeting: "Team", subtitle: `Amoré Bloom's internal team members and invitations. ${getDataPersistenceMessage()}` }} />

        {metrics.length > 0 ? (
          <div className="animate-fade-up stagger-1 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {metrics.map((metric) => (
              <LuxuryMetricCard key={metric.id} data={metric} />
            ))}
          </div>
        ) : null}

        <div className="animate-fade-up stagger-2">
          <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-rose uppercase">Today</p>
          <h2 className="mt-1 font-luxury-display text-luxury-page font-semibold text-luxury-text">A little look at today ♡</h2>
        </div>

        <div className="animate-fade-up stagger-2">
          <CompactClockWeatherPanel location={DEFAULT_OPERATIONAL_LOCATION} forecast={operationalForecast} />
        </div>

        <div className="animate-fade-up stagger-3 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <TodaysPriorityCard priority={todaysPriority} className="lg:col-span-2" />
          <LittleReminderCard reminder={littleReminder} />
        </div>

        <div className="animate-fade-up stagger-4">
          <LuxuryCard>
            <SectionHeader title="Upcoming Events" action={<Link href="/events" className="text-luxury-small font-medium text-luxury-rose">View all</Link>} />
            {upcomingEvents.length === 0 ? (
              <EmptyState title="No upcoming events" description="Booked events appear here." />
            ) : (
              <div className="space-y-1">
                {upcomingEvents.map((event) => (
                  <EventPreviewCard key={event.id} data={event} />
                ))}
              </div>
            )}
          </LuxuryCard>
        </div>

        <div className="animate-fade-up stagger-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <TodaysTimelineCard items={todaysTimeline} className="lg:col-span-2" />
          <TodaysPulseCard metrics={todaysPulse} />
        </div>

        {state.status === "loading" ? (
          <div className="animate-fade-up stagger-6 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : state.status === "error" ? (
          <div className="animate-fade-up stagger-6">
            <ErrorState onRetry={load} />
          </div>
        ) : (
          <div className="animate-fade-up stagger-6 space-y-6">
            {actionError ? (
              <div role="alert" className="rounded-luxury-md border border-luxury-border bg-luxury-surface px-3 py-2 text-luxury-small text-luxury-rose">
                {actionError}
              </div>
            ) : null}

            {copiedLink ? (
              <div role="status" className="rounded-luxury-md border border-luxury-border bg-luxury-surface px-3 py-2 text-luxury-small text-luxury-text">
                Invitation link for {copiedLink.email}: <code className="break-all text-luxury-rose">{copiedLink.url}</code>
              </div>
            ) : null}

            <LuxuryCard>
              <SectionHeader title="Members" />
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-luxury-small">
                  <thead>
                    <tr className="border-b border-luxury-border text-luxury-metadata text-luxury-text-muted uppercase">
                      <th className="pb-2 pr-3 font-normal">Name</th>
                      <th className="pb-2 pr-3 font-normal">Email</th>
                      <th className="pb-2 pr-3 font-normal">Role</th>
                      <th className="pb-2 pr-3 font-normal">Dashboard role</th>
                      <th className="pb-2 pr-3 font-normal">Status</th>
                      <th className="pb-2 pr-3 font-normal">Joined</th>
                      {canManageRoles ? <th className="pb-2 font-normal">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {state.members.map((member) => (
                      <tr key={member.id} className="border-b border-luxury-border/60 last:border-0">
                        <td className="py-2 pr-3 text-luxury-text">{member.full_name ?? "—"}</td>
                        <td className="py-2 pr-3 text-luxury-text-muted">{member.email}</td>
                        <td className="py-2 pr-3">
                          {canManageRoles ? (
                            <select
                              aria-label={`Role for ${member.email}`}
                              value={member.role}
                              disabled={busyId === member.id}
                              onChange={(event) => runAction(member.id, () => updateWorkspaceMemberRole(member.id, event.target.value as WorkspaceMemberRole))}
                              className="rounded-luxury-md border border-luxury-border bg-transparent px-1.5 py-1 text-luxury-small text-luxury-text"
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
                          {canManageRoles ? (
                            <select
                              aria-label={`Dashboard role for ${member.email}`}
                              value={state.teamRoleLabels[member.id] ?? DEFAULT_TEAM_ROLE_LABEL}
                              disabled={busyId === member.id}
                              onChange={(event) => runAction(member.id, () => setTeamRoleLabelAction(member.id, event.target.value as TeamRoleLabel))}
                              className="rounded-luxury-md border border-luxury-border bg-transparent px-1.5 py-1 text-luxury-small text-luxury-text"
                            >
                              {TEAM_ROLE_LABELS.map((label) => (
                                <option key={label} value={label}>
                                  {TEAM_ROLE_LABEL_NAMES[label]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge tone="outline">{TEAM_ROLE_LABEL_NAMES[state.teamRoleLabels[member.id] ?? DEFAULT_TEAM_ROLE_LABEL]}</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge tone={member.status === "active" ? "accent" : "neutral"}>{member.status === "active" ? "Active" : "Suspended"}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-luxury-text-muted">{formatDate(member.created_at)}</td>
                        {canManageRoles ? (
                          <td className="py-2">
                            <div className="flex gap-2">
                              {member.status === "active" ? (
                                <Button variant="secondary" disabled={busyId === member.id} onClick={() => runAction(member.id, () => deactivateWorkspaceMember(member.id))}>
                                  Deactivate
                                </Button>
                              ) : (
                                <Button variant="secondary" disabled={busyId === member.id} onClick={() => runAction(member.id, () => reactivateWorkspaceMember(member.id))}>
                                  Reactivate
                                </Button>
                              )}
                              <Button variant="secondary" disabled={busyId === member.id} onClick={() => runAction(member.id, () => removeWorkspaceMember(member.id))}>
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
            </LuxuryCard>

            <LuxuryCard>
              <SectionHeader title="Invitations" action={canInvite ? <Button onClick={() => setNewInvitationOpen(true)}>New Invitation</Button> : undefined} />

              {state.invitations.length === 0 ? (
                <div className="mt-3">
                  <EmptyState title="No invitations yet" description={canInvite ? "Invite a team member to get started." : undefined} />
                </div>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-luxury-small">
                    <thead>
                      <tr className="border-b border-luxury-border text-luxury-metadata text-luxury-text-muted uppercase">
                        <th className="pb-2 pr-3 font-normal">Email</th>
                        <th className="pb-2 pr-3 font-normal">Role</th>
                        <th className="pb-2 pr-3 font-normal">Status</th>
                        <th className="pb-2 pr-3 font-normal">Expires</th>
                        {canInvite ? <th className="pb-2 font-normal">Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {state.invitations.map((invitation) => (
                        <tr key={invitation.id} className="border-b border-luxury-border/60 last:border-0">
                          <td className="py-2 pr-3 text-luxury-text">{invitation.email}</td>
                          <td className="py-2 pr-3 text-luxury-text-muted">{WORKSPACE_MEMBER_ROLE_LABELS[invitation.invited_role]}</td>
                          <td className="py-2 pr-3">
                            <Badge tone={invitation.status === "pending" ? "outline" : invitation.status === "accepted" ? "accent" : "neutral"}>
                              {INVITATION_STATUS_LABELS[invitation.status]}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 text-luxury-text-muted">{formatDate(invitation.expires_at)}</td>
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
                                  <Button variant="secondary" disabled={busyId === invitation.id} onClick={() => runAction(invitation.id, () => revokeWorkspaceInvitation(invitation.id))}>
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
            </LuxuryCard>
          </div>
        )}
      </div>

      <NewInvitationModal
        open={newInvitationOpen}
        onClose={() => setNewInvitationOpen(false)}
        onCreate={createWorkspaceInvitation}
        onCreated={(result) => {
          setCopiedLink({ email: result.invitation.email, url: `${window.location.origin}/invitations/${result.token}` });
          load();
        }}
      />
    </LuxuryDashboardShell>
  );
}
