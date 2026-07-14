"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  createClientNote,
  getClientById,
  getClientNextAction,
  getNotesByClientId,
  getTimelineByClientId,
  togglePinNote,
} from "@/lib/data";
import type { Client } from "@/types/client";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NotesSection } from "@/modules/notes/components/NotesSection";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { ClientStatusBadge } from "@/modules/clients/components/ClientStatusBadge";
import { VipBadge } from "@/modules/clients/components/VipBadge";
import { ClientActions } from "@/modules/clients/components/ClientActions";
import { TagsEditor } from "@/modules/clients/components/TagsEditor";
import { CONTACT_METHOD_LABELS } from "@/core/enums/contactMethod";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "ready";
      client: Client;
      notes: Note[];
      timeline: TimelineActivity[];
      nextAction: string | null;
    };

async function loadClientDetail(clientId: string): Promise<LoadState> {
  try {
    const [client, notes, timeline, nextAction] = await Promise.all([
      getClientById(clientId),
      getNotesByClientId(clientId),
      getTimelineByClientId(clientId),
      getClientNextAction(clientId),
    ]);
    return { status: "ready", client, notes, timeline, nextAction };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function ClientDetailView({ clientId }: { clientId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadClientDetail(clientId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Same rationale as LeadDetailView: keep the current tree mounted while a
  // refetch runs in the background, so local feedback (e.g. quick-action
  // errors) isn't unmounted before the user sees it.
  const refetch = () => {
    loadClientDetail(clientId).then(setState);
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
    return <ErrorState message="This client could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this client." onRetry={refetch} />;
  }

  const { client, notes, timeline, nextAction } = state;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
            {client.first_name[0]}
            {client.last_name[0]}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-text">
                {client.first_name} {client.last_name}
                {client.partner_name ? ` & ${client.partner_name}` : ""}
              </h2>
              <ClientStatusBadge status={client.internal_status} />
              <VipBadge isVip={client.is_vip} />
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {client.email}
              {client.source ? ` · ${client.source}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <ClientActions client={client} onChanged={refetch} />
        </div>
      </div>

      {nextAction ? (
        <Card className="border-accent/40 bg-accent/5">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            Next recommended action
          </p>
          <p className="mt-1 text-sm text-text">{nextAction}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="text-sm font-medium text-text-muted">Contact</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Email" value={client.email} />
              <Field label="Phone" value={client.phone} />
              <Field label="Instagram" value={client.instagram} />
              <Field
                label="Preferred contact method"
                value={
                  client.preferred_contact_method
                    ? CONTACT_METHOD_LABELS[client.preferred_contact_method]
                    : null
                }
              />
            </dl>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-text-muted">Relationship</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Partner" value={client.partner_name} />
              <Field label="Relationship status" value={client.relationship_status} />
              <Field label="How they met" value={client.how_they_met} />
              <Field label="First date" value={formatDate(client.first_date)} />
              <Field label="Anniversary" value={formatDate(client.relationship_anniversary)} />
              <Field label="Proposal date" value={formatDate(client.engagement_date)} />
              <Field label="Wedding date" value={formatDate(client.wedding_date)} />
            </dl>
            {client.important_dates.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-text-muted">Important dates</p>
                <ul className="mt-1.5 space-y-1">
                  {client.important_dates.map((date) => (
                    <li key={date.id} className="text-sm text-text">
                      {date.label} — {formatDate(date.date)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-text-muted">Address</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Address" value={client.address} />
              <Field label="City" value={client.city} />
              <Field label="State" value={client.state} />
              <Field label="ZIP code" value={client.zip_code} />
            </dl>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-text-muted">Preferences</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Color palette" value={client.favorite_colors} />
              <Field label="Favorite flowers" value={client.favorite_flowers} />
              <Field label="Favorite music" value={client.favorite_music} />
              <Field label="Favorite food" value={client.favorite_food} />
              <Field label="Favorite drinks" value={client.favorite_drinks} />
              <Field label="Preferred style" value={client.preferred_style} />
              <Field label="Disliked elements" value={client.disliked_elements} />
              <Field label="Accessibility" value={client.accessibility_needs} />
              <Field label="Dietary restrictions" value={client.dietary_restrictions} />
              <Field label="Communication notes" value={client.preferred_communication_time} />
              <Field label="Allergies" value={client.allergies} />
              <Field label="Emergency contact" value={formatEmergencyContact(client)} />
              <Field label="Do not call" value={client.do_not_call ? "Yes" : "No"} />
              <Field
                label="Surprise-event confidentiality"
                value={client.surprise_event_confidentiality ? "Yes" : "No"}
              />
            </dl>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-text-muted">Notes</h3>
            <div className="mt-3">
              <NotesSection
                workspaceId={client.workspace_id}
                ownerType="client"
                ownerId={client.id}
                notes={notes}
                onCreateNote={(input) => createClientNote(client.id, input)}
                onTogglePin={togglePinNote}
                readOnly={false}
                onNotesChanged={refetch}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-medium text-text-muted">Internal</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3">
              <div>
                <dt className="text-xs text-text-muted">Tags</dt>
                <dd className="mt-1.5 text-sm text-text">
                  {client.archived_at ? (
                    client.tags.length > 0 ? (
                      client.tags.join(", ")
                    ) : (
                      "—"
                    )
                  ) : (
                    <TagsEditor clientId={client.id} tags={client.tags} onChanged={refetch} />
                  )}
                </dd>
              </div>
              <Field label="Internal status" value={<ClientStatusBadge status={client.internal_status} />} />
              <Field label="Returning client" value={client.is_returning ? "Yes" : "No"} />
              <Field
                label="Originating Lead"
                value={
                  client.originating_lead_id ? (
                    <Link
                      href={`/leads/${client.originating_lead_id}`}
                      className="text-accent hover:underline"
                    >
                      View original Lead →
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Created" value={new Date(client.created_at).toLocaleDateString()} />
              <Field label="Updated" value={new Date(client.updated_at).toLocaleDateString()} />
              {client.archived_at ? (
                <Field label="Archived" value={new Date(client.archived_at).toLocaleDateString()} />
              ) : null}
            </dl>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-text-muted">Timeline</h3>
            <div className="mt-3">
              <Timeline activities={timeline} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || "—"}</dd>
    </div>
  );
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString();
}

function formatEmergencyContact(client: Client): string | null {
  if (!client.emergency_contact_name && !client.emergency_contact_phone) return null;
  return [client.emergency_contact_name, client.emergency_contact_phone].filter(Boolean).join(" · ");
}
