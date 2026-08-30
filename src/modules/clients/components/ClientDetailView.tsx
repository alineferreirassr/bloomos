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
  getEvents,
  getClientFinancialSummary,
} from "@/lib/data";
import type { ClientFinancialSummary } from "@/modules/finance/financialSummary";
import type { Client } from "@/types/client";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Event } from "@/types/event";
import { NotFoundError } from "@/core/errors";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { NotesSection } from "@/modules/notes/components/NotesSection";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { EntityTimelinePanel } from "@/modules/communication/timeline/components/EntityTimelinePanel";
import { CommentsPanel } from "@/modules/communication/comments/components/CommentsPanel";
import { ClientStatusBadge } from "@/modules/clients/components/ClientStatusBadge";
import { VipBadge } from "@/modules/clients/components/VipBadge";
import { ClientActions } from "@/modules/clients/components/ClientActions";
import { TagsEditor } from "@/modules/clients/components/TagsEditor";
import { DocumentsSummarySection } from "@/modules/documents/components/DocumentsSummarySection";
import { DocumentBundlesSection } from "@/modules/documentTemplates/components/DocumentBundlesSection";
import { ClientAccessSection } from "@/modules/clientAccess/components/ClientAccessSection";
import { ClientPortalActivitySection } from "@/modules/clients/components/ClientPortalActivitySection";
import { ClientEventsSummaryCard } from "@/modules/events/components/ClientEventsSummaryCard";
import { ClientFinancialSummaryCard } from "@/modules/finance/components/ClientFinancialSummaryCard";
import { ClientJourneySummaryCard } from "@/modules/clientJourney/components/ClientJourneySummaryCard";
import { CONTACT_METHOD_LABELS } from "@/core/enums/contactMethod";
import { BloomAvatar } from "@/components/ui/BloomAvatar";
import { useSetCopilotPageContext } from "@/modules/ai/copilot/CopilotPageContextProvider";

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
      events: Event[];
      financialSummary: ClientFinancialSummary;
    };

async function loadClientDetail(clientId: string): Promise<LoadState> {
  try {
    const [client, notes, timeline, nextAction, events, financialSummary] = await Promise.all([
      getClientById(clientId),
      getNotesByClientId(clientId),
      getTimelineByClientId(clientId),
      getClientNextAction(clientId),
      getEvents({ clientId }),
      getClientFinancialSummary(clientId),
    ]);
    return { status: "ready", client, notes, timeline, nextAction, events, financialSummary };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

/**
 * "Client Detail — Luxury Aesthetic Reorganization" checkpoint — same data,
 * same actions, same child components (`ClientAccessSection`,
 * `ClientPortalActivitySection`, `ClientEventsSummaryCard`,
 * `ClientFinancialSummaryCard`, `ClientJourneySummaryCard`,
 * `DocumentsSummarySection`, `DocumentBundlesSection`), but recomposed as
 * one editorial "client dossier" flow instead of a 2/3-content +
 * 1/3-narrow-rail split. The rail's ~10 stacked cards are RELOCATED into
 * full-width sections in the order the Founder specified (Hero → Snapshot
 * → Next Action → Profile → Journey → Events → Finance → Documents → Notes
 * → Communication → Access & Portal) — nothing was deleted. Documents
 * (Documents/Bundles) and Communication (Activity/Updates/Comments) use the
 * existing `Tabs` primitive to group already-separate components visually
 * without merging their data models, per the Founder's explicit "visual
 * grouping only" instruction.
 */
export function ClientDetailView({ clientId }: { clientId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  useSetCopilotPageContext(
    state.status === "ready"
      ? { module: "crm", entity: { type: "client", id: state.client.id, label: `${state.client.first_name} ${state.client.last_name}` } }
      : { module: "crm", entity: null },
  );

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

  const { client, notes, timeline, nextAction, events, financialSummary } = state;
  const upcomingEvents = events.filter((e) => e.event_date !== null && new Date(e.event_date) >= new Date()).sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));
  const preferenceFields: { label: string; value: ReactNode }[] = [
    { label: "Color palette", value: client.favorite_colors },
    { label: "Favorite flowers", value: client.favorite_flowers },
    { label: "Favorite music", value: client.favorite_music },
    { label: "Favorite food", value: client.favorite_food },
    { label: "Favorite drinks", value: client.favorite_drinks },
    { label: "Preferred style", value: client.preferred_style },
    { label: "Disliked elements", value: client.disliked_elements },
    { label: "Accessibility", value: client.accessibility_needs },
    { label: "Dietary restrictions", value: client.dietary_restrictions },
    { label: "Communication notes", value: client.preferred_communication_time },
    { label: "Allergies", value: client.allergies },
    { label: "Emergency contact", value: formatEmergencyContact(client) },
  ].filter((f) => Boolean(f.value));
  const flagFields = [
    { label: "Do not call", value: client.do_not_call },
    { label: "Surprise-event confidentiality", value: client.surprise_event_confidentiality },
  ].filter((f) => f.value);

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      {/* 01 — Client Hero */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <BloomAvatar name={`${client.first_name} ${client.last_name}`} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-3xl font-semibold text-text" style={{ textWrap: "balance" }}>
                {client.first_name} {client.last_name}
                {client.partner_name ? ` & ${client.partner_name}` : ""}
              </h2>
              <ClientStatusBadge status={client.internal_status} />
              <VipBadge isVip={client.is_vip} />
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {client.email}
              {client.phone ? ` · ${client.phone}` : ""}
              {client.preferred_contact_method ? ` · Prefers ${CONTACT_METHOD_LABELS[client.preferred_contact_method]}` : ""}
            </p>
          </div>
        </div>
        <ClientActions client={client} onChanged={refetch} />
      </div>

      {/* 02 — Client Snapshot */}
      <div className="grid grid-cols-2 gap-4 rounded-luxury-lg bg-luxury-surface-tint p-5 shadow-luxury-sm sm:grid-cols-3 lg:grid-cols-5">
        <Snapshot label="Source" value={client.source} />
        <Snapshot label="Client since" value={new Date(client.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })} />
        <Snapshot label="Returning client" value={client.is_returning ? "Yes" : "No"} />
        <Snapshot label="Events" value={String(events.length)} helper={upcomingEvents[0]?.event_date ? `Next: ${new Date(upcomingEvents[0].event_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : null} />
        <Snapshot label="Tags" value={client.archived_at ? (client.tags.length > 0 ? client.tags.join(", ") : null) : <TagsEditor clientId={client.id} tags={client.tags} onChanged={refetch} />} />
      </div>

      {/* 03 — Next Recommended Action */}
      {nextAction ? (
        <div className="flex items-start gap-3 rounded-luxury-lg border border-luxury-rose/30 bg-luxury-blush/40 px-5 py-4">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-luxury-rose" aria-hidden="true" />
          <div>
            <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-rose uppercase">Next recommended action</p>
            <p className="mt-1 text-sm text-text">{nextAction}</p>
          </div>
        </div>
      ) : null}

      {/* 04 — Client Profile */}
      <Section eyebrow="Who is this client" title="Client Profile">
        <LuxuryCard>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <SubGroup title="Contact">
                <Field label="Email" value={client.email} />
                <Field label="Phone" value={client.phone} />
                <Field label="Instagram" value={client.instagram} />
                <Field label="Preferred contact method" value={client.preferred_contact_method ? CONTACT_METHOD_LABELS[client.preferred_contact_method] : null} />
              </SubGroup>

              <SubGroup title="Relationship">
                <Field label="Partner" value={client.partner_name} />
                <Field label="Relationship status" value={client.relationship_status} />
                <Field label="How they met" value={client.how_they_met} />
                <Field label="First date" value={formatDate(client.first_date)} />
                <Field label="Anniversary" value={formatDate(client.relationship_anniversary)} />
                <Field label="Proposal date" value={formatDate(client.engagement_date)} />
                <Field label="Wedding date" value={formatDate(client.wedding_date)} />
              </SubGroup>
              {client.important_dates.length > 0 ? (
                <div>
                  <p className="text-luxury-metadata font-medium tracking-wide text-luxury-text-muted uppercase">Important dates</p>
                  <ul className="mt-1.5 space-y-1">
                    {client.important_dates.map((date) => (
                      <li key={date.id} className="text-sm text-text">
                        {date.label} — {formatDate(date.date)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <SubGroup title="Address">
                <Field label="Address" value={client.address} />
                <Field label="City" value={client.city} />
                <Field label="State" value={client.state} />
                <Field label="ZIP code" value={client.zip_code} />
              </SubGroup>

              <div>
                <p className="text-luxury-metadata font-medium tracking-wide text-luxury-text-muted uppercase">Preferences</p>
                {preferenceFields.length === 0 && flagFields.length === 0 ? (
                  <p className="mt-2 text-sm text-luxury-text-muted">No preferences recorded yet.</p>
                ) : (
                  <>
                    {preferenceFields.length > 0 ? (
                      <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {preferenceFields.map((f) => (
                          <Field key={f.label} label={f.label} value={f.value} />
                        ))}
                      </dl>
                    ) : null}
                    {flagFields.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {flagFields.map((f) => (
                          <span key={f.label} className="rounded-full bg-luxury-blush px-2.5 py-1 text-luxury-metadata font-medium text-luxury-rose">
                            {f.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div>
                <p className="text-luxury-metadata font-medium tracking-wide text-luxury-text-muted uppercase">Internal</p>
                <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label="Originating Lead"
                    value={client.originating_lead_id ? <Link href={`/leads/${client.originating_lead_id}`} className="text-accent hover:underline">View original Lead →</Link> : null}
                  />
                  <Field label="Created" value={new Date(client.created_at).toLocaleDateString()} />
                  <Field label="Updated" value={new Date(client.updated_at).toLocaleDateString()} />
                  {client.archived_at ? <Field label="Archived" value={new Date(client.archived_at).toLocaleDateString()} /> : null}
                </dl>
              </div>
            </div>
          </div>
        </LuxuryCard>
      </Section>

      {/* 05 — Client Journey */}
      <Section eyebrow="Where they are" title="Client Journey">
        <ClientJourneySummaryCard clientId={client.id} />
      </Section>

      {/* 06 — Events */}
      <Section eyebrow="What we're delivering" title="Events">
        <ClientEventsSummaryCard events={events} />
      </Section>

      {/* 07 — Financial Overview */}
      <Section eyebrow="Where things stand financially" title="Financial Overview">
        <ClientFinancialSummaryCard clientId={client.id} summary={financialSummary} />
      </Section>

      {/* 08 — Documents */}
      <Section eyebrow="What exists" title="Documents">
        <Tabs defaultValue="documents">
          <TabList aria-label="Documents">
            <Tab value="documents">Documents</Tab>
            <Tab value="bundles">Bundles</Tab>
          </TabList>
          <TabPanel value="documents" className="pt-4">
            <DocumentsSummarySection ownerType="client" ownerId={client.id} newDocumentParams={{ clientId: client.id }} />
          </TabPanel>
          <TabPanel value="bundles" className="pt-4">
            <DocumentBundlesSection clientId={client.id} />
          </TabPanel>
        </Tabs>
      </Section>

      {/* 09 — Notes */}
      <Section eyebrow="What we've recorded" title="Notes">
        <LuxuryCard>
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
        </LuxuryCard>
      </Section>

      {/* 10 — Communication */}
      <Section eyebrow="What we've communicated" title="Communication">
        <Tabs defaultValue="activity">
          <TabList aria-label="Communication">
            <Tab value="activity">Activity</Tab>
            <Tab value="updates">Updates</Tab>
            <Tab value="comments">Comments</Tab>
          </TabList>
          <TabPanel value="activity" className="pt-4">
            <LuxuryCard>
              <Timeline activities={timeline} />
            </LuxuryCard>
          </TabPanel>
          <TabPanel value="updates" className="pt-4">
            <LuxuryCard>
              <EntityTimelinePanel ownerType="client" ownerId={client.id} />
            </LuxuryCard>
          </TabPanel>
          <TabPanel value="comments" className="pt-4">
            <LuxuryCard>
              <CommentsPanel ownerType="client" ownerId={client.id} />
            </LuxuryCard>
          </TabPanel>
        </Tabs>
      </Section>

      {/* 11 — Access & Portal */}
      <Section eyebrow="Do they have portal access" title="Access & Portal">
        <div className="space-y-4">
          <ClientAccessSection clientId={client.id} clientEmail={client.email} />
          <ClientPortalActivitySection clientId={client.id} />
        </div>
      </Section>
    </div>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section>
      <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-rose uppercase">{eyebrow}</p>
      <h2 className="mt-1 mb-4 font-luxury-display text-luxury-section font-semibold text-luxury-text">{title}</h2>
      {children}
    </section>
  );
}

function SubGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-luxury-metadata font-medium tracking-wide text-luxury-text-muted uppercase">{title}</p>
      <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function Snapshot({ label, value, helper }: { label: string; value: ReactNode; helper?: string | null }) {
  return (
    <div>
      <p className="text-luxury-metadata font-medium tracking-wide text-luxury-text-muted uppercase">{label}</p>
      <p className="mt-1 text-luxury-small font-medium text-text">{value || "—"}</p>
      {helper ? <p className="text-luxury-metadata text-luxury-text-muted">{helper}</p> : null}
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
