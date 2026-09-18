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
import { Card } from "@/components/ui/Card";
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
      <div className="space-y-4">
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
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-semibold text-text">{getLeadDisplayName(lead)}</h2>
          <LeadStatusBadge status={lead.status} />
          {lead.source === "Instagram" ? <Badge tone="neutral">Instagram</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-text-muted">{lead.email}</p>
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
        <Card className="border-accent/40 bg-accent/5">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            Next recommended action
          </p>
          <p className="mt-1 text-sm text-text">{nextAction}</p>
        </Card>
      ) : null}

      {!isReadOnly ? <LeadJourneySummaryCard leadId={lead.id} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Contact information</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Instagram" value={lead.instagram} />
              <Field label="Source" value={lead.source} />
              <Field label="Assigned to" value={lead.assigned_to} emptyLabel="Unassigned" />
              {attribution.kind !== "none" ? <Field label="Content Attribution" value={attributionLabel(attribution)} /> : null}
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Event information</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Event type" value={lead.event_type} />
              <Field
                label="Event date"
                value={lead.event_date ? new Date(lead.event_date).toLocaleDateString() : null}
              />
              <Field label="Location" value={lead.location} />
              <Field label="Budget" value={formatBudget(lead.budget_min, lead.budget_max)} />
            </dl>
            {lead.message ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-text-muted">Message</p>
                <p className="mt-1 text-sm text-text">{lead.message}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
            <div className="mt-3">
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
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Status</h3>
            <div className="mt-3">
              <LeadStatusSelect leadId={lead.id} status={lead.status} onChanged={refetch} />
            </div>
          </Card>
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Timeline</h3>
            <div className="mt-3">
              <Timeline activities={timeline} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, emptyLabel = "—" }: { label: string; value: string | null; emptyLabel?: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || emptyLabel}</dd>
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
