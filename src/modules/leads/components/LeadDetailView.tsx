"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createNote, getLeadById, getNotesByLeadId, getTimelineByLeadId, togglePinNote } from "@/lib/data";
import { resolveLeadAttribution } from "@/modules/socialAttribution/resolveLeadAttribution";
import type { Lead } from "@/types/lead";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { LeadAttributionDisplay } from "@/modules/socialAttribution/types";
import { NotFoundError } from "@/core/errors";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { LeadStatusBadge } from "@/modules/leads/components/LeadStatusBadge";
import { LeadStatusSelect } from "@/modules/leads/components/LeadStatusSelect";
import { LeadActions } from "@/modules/leads/components/LeadActions";
import { NotesSection } from "@/modules/notes/components/NotesSection";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { getNextRecommendedAction } from "@/core/workflows/leadWorkflow";
import { LeadJourneySummaryCard } from "@/modules/clientJourney/components/LeadJourneySummaryCard";
import { getLeadDisplayName } from "@/lib/personName";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; lead: Lead; notes: Note[]; timeline: TimelineActivity[]; attribution: LeadAttributionDisplay };

async function loadLeadDetail(leadId: string): Promise<LoadState> {
  try {
    const [lead, notes, timeline] = await Promise.all([
      getLeadById(leadId),
      getNotesByLeadId(leadId),
      getTimelineByLeadId(leadId),
    ]);
    // SOCIAL-15D — resolves this Lead's own stored attribution (never an
    // aggregate, never inferred). Runs after `lead` is known since it reads
    // `lead.social_post_id`/etc directly off the already-fetched row.
    const attribution = await resolveLeadAttribution(lead);
    return { status: "ready", lead, notes, timeline, attribution };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

/** SOCIAL-15D — a plain-text summary of `LeadAttributionDisplay`, matching this Field's own `string | null` shape. Never exposes raw comment/DM content — only the Social Post's own workspace-authored caption, when resolvable. */
function attributionLabel(attribution: LeadAttributionDisplay): string | null {
  switch (attribution.kind) {
    case "social_post":
      return attribution.socialPost ? `From an Instagram post: "${attribution.socialPost.caption}"` : "From an Instagram post";
    case "instagram_comment":
      return "From an Instagram comment";
    case "instagram_conversation":
      return "From an Instagram DM";
    case "none":
      return null;
  }
}

export function LeadDetailView({ leadId }: { leadId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadLeadDetail(leadId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // Deliberately does NOT flip to `{ status: "loading" }` first: doing so would
  // unmount the current tree (including LeadActions' local success/error
  // feedback message) before the user ever sees it. The existing content
  // stays visible while fresh data loads in the background, then swaps in.
  const refetch = () => {
    loadLeadDetail(leadId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This lead could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this lead." onRetry={refetch} />;
  }

  const { lead, notes, timeline, attribution } = state;
  const isReadOnly = lead.status === "converted";
  const nextAction = getNextRecommendedAction(lead);
  // SOCIAL-13E — mirrors convertLeadToClient()'s own two real guards exactly
  // (LeadConversionService.ts / convert_lead_to_client(), both added in
  // SOCIAL-13C-FND): a Lead missing a name or email — e.g. an
  // Instagram-originated Lead before a human backfills the rest — is
  // rejected there with a clear, controlled error. This is a proactive
  // indication of that same real, existing rule, not a new one; the
  // Convert button itself is left exactly as it was, still always clickable.
  const needsIdentityForConversion = !lead.first_name || !lead.last_name || !lead.email;

  return (
    // GLOBAL-VISUAL-04R — AF's own real detail-page pattern
    // (app/(app)/app/leads/[id]/page.tsx, HEAD 1587d1f): the simpler design-
    // system `PageHeader` (not ModuleHero — AF itself only uses ModuleHero
    // on hub pages), a plain status/badge row underneath (no card), and
    // content sections separated by a `border-t pt-6` divider with a
    // `font-serif text-xl` heading instead of each one living in its own
    // bordered Card. Same data, same actions, same permissions.
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Lead"
        title={getLeadDisplayName(lead)}
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Leads", href: "/leads" }, { label: getLeadDisplayName(lead) }]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <LeadStatusBadge status={lead.status} />
        {lead.source === "Instagram" ? <Badge tone="neutral">Instagram</Badge> : null}
        <span className="text-sm text-text-muted">{lead.email}</span>
      </div>

      {isReadOnly ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-text-muted">
          This lead was converted to a Client and is read-only.
          {lead.converted_client_id ? (
            <>
              {" "}
              <Link
                className="font-medium text-accent hover:underline"
                href={`/clients/${lead.converted_client_id}`}
              >
                View the Client record →
              </Link>
            </>
          ) : null}
        </div>
      ) : (
        <LeadActions lead={lead} onChanged={refetch} onConverted={refetch} />
      )}

      {!isReadOnly && needsIdentityForConversion ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-text-muted">
          This Lead needs a name and email before it can be converted to a Client.
        </div>
      ) : null}

      {nextAction && !isReadOnly ? (
        <div className="rounded-xl border border-accent/30 bg-accent-100/40 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Next recommended action</p>
          <p className="mt-1 text-sm text-text">{nextAction}</p>
        </div>
      ) : null}

      {!isReadOnly ? <LeadJourneySummaryCard leadId={lead.id} /> : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-serif text-xl text-text">Status</h2>
            <LeadStatusSelect leadId={lead.id} status={lead.status} onChanged={refetch} />
          </section>
          <section className="border-t border-border/60 pt-6">
            <h2 className="mb-2 font-serif text-xl text-text">Details</h2>
            <dl className="divide-y divide-border/60">
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Instagram" value={lead.instagram} />
              <Field label="Source" value={lead.source} />
              <Field label="Assigned to" value={lead.assigned_to} emptyLabel="Unassigned" />
              {attribution.kind !== "none" ? <Field label="Content Attribution" value={attributionLabel(attribution)} /> : null}
              <Field label="Event type" value={lead.event_type} />
              <Field label="Event date" value={lead.event_date ? new Date(lead.event_date).toLocaleDateString() : null} />
              <Field label="Location" value={lead.location} />
              <Field label="Budget" value={formatBudget(lead.budget_min, lead.budget_max)} />
            </dl>
            {lead.message ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-text-muted">Message</p>
                <p className="mt-1 text-sm text-text">{lead.message}</p>
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-serif text-xl text-text">Notes</h2>
            <NotesSection
              workspaceId={lead.workspace_id}
              ownerType="lead"
              ownerId={lead.id}
              notes={notes}
              onCreateNote={(input) => createNote(lead.id, input)}
              onTogglePin={togglePinNote}
              readOnly={isReadOnly}
              onNotesChanged={refetch}
            />
          </section>
          <section className="border-t border-border/60 pt-6">
            <h2 className="mb-3 font-serif text-xl text-text">Timeline</h2>
            <Timeline activities={timeline} />
          </section>
        </div>
      </div>
    </div>
  );
}

// GLOBAL-VISUAL-04R — matches AF's own `Info` row in its real Lead detail
// page: a plain `dt`/`dd` pair inside a `divide-y` list, not a boxed grid
// cell.
function Field({ label, value, emptyLabel = "—" }: { label: string; value: string | null; emptyLabel?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-text">{value || emptyLabel}</dd>
    </div>
  );
}

function formatBudget(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  if (min !== null && max !== null) return `${fmt(min)} – ${fmt(max)}`;
  if (min !== null) return `From ${fmt(min)}`;
  return `Up to ${fmt(max as number)}`;
}
