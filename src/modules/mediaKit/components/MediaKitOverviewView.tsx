"use client";

import { useEffect, useState } from "react";
import { ModuleHero } from "@/components/ui/ModuleHero";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { MediaKitIcon } from "@/components/ui/icons";
import { getMediaKitOverviewData } from "@/modules/mediaKit/getMediaKitOverviewData";
import { createMediaKitAction } from "@/modules/mediaKit/createMediaKitAction";
import type { MediaKitContentStatus, MediaKitEventType, MediaKitOverview, MediaKitSectionReadiness } from "@/types/mediaKit";

type LoadState =
  | { status: "loading" }
  | { status: "not_configured" }
  | { status: "ready"; data: MediaKitOverview }
  | { status: "error" };

const SECTION_KEYS = ["brand", "services", "portfolio", "partners", "testimonials", "press", "gallery", "contact"] as const;

const SECTION_LABELS: Record<(typeof SECTION_KEYS)[number], string> = {
  brand: "Brand",
  services: "Services",
  portfolio: "Portfolio",
  partners: "Partners",
  testimonials: "Testimonials",
  press: "Press",
  gallery: "Gallery",
  contact: "Contact",
};

const ACTIVITY_LABELS: Record<MediaKitEventType, string> = {
  viewed: "Page viewed",
  cta_clicked: "Call-to-action clicked",
  contact_started: "Contact form started",
  inquiry_submitted: "Inquiry submitted",
};

function ReadinessBadge({ readiness }: { readiness: MediaKitSectionReadiness }) {
  return <Badge tone={readiness === "ready" ? "success" : "neutral"}>{readiness === "ready" ? "Ready" : "Not started"}</Badge>;
}

function ComingSoonSection({ title, description, note }: { title: string; description: string; note: string }) {
  return (
    <EmptyState
      icon={MediaKitIcon}
      title={title}
      description={description}
      secondaryAction={note}
    />
  );
}

const SECTION_COPY: Record<(typeof SECTION_KEYS)[number], { title: string; description: string }> = {
  brand: { title: "Tell your brand story", description: "Share Amoré Bloom's positioning, your longer brand narrative, and where you work." },
  services: { title: "Choose the services you want to feature", description: "Select which of your Services appear on your public Media Kit, with their own headline and starting price." },
  portfolio: { title: "Build your portfolio", description: "Showcase your favorite work — from a real Event or a standalone feature." },
  partners: { title: "Add selected partners", description: "Feature the brands, venues, and collaborators you're proud to work with." },
  testimonials: { title: "Add approved testimonials", description: "Share the words your clients have used to describe working with you." },
  press: { title: "Add press features", description: "Highlight where Amoré Bloom has been featured." },
  gallery: { title: "Build your gallery", description: "Curate the images that tell your story visually." },
  contact: { title: "Set up your inquiry form", description: "Decide how visitors reach out, and where their inquiry goes." },
};

/**
 * The private Media Kit Manager's Overview + section-navigation foundation
 * (MEDIAKIT-02). Self-fetches on mount, mirroring
 * `IntegrationsDashboardView.tsx`'s exact loading/ready/error shape.
 *
 * Every one of the 13 capabilities from the approved information
 * architecture (Overview/Brand/Services/Portfolio/Partners/Testimonials/
 * Press/Metrics/Social/Gallery/Contact & CTA/Appearance/Publish) has an
 * in-page Tab here rather than its own route — the same "cleaner
 * sub-navigation over 13 independent pages" choice this session's other
 * hub pages already made. Every tab beyond Overview/Metrics/Publish is a
 * polished, honestly-labeled "coming soon" state (Phase 12) — no editor
 * exists yet, and none of this data is fabricated to make it look
 * otherwise.
 *
 * Future public route: `/media-kit` is now the authenticated Manager, so
 * the public renderer (MEDIAKIT-06+) needs a distinct path. Recommended:
 * `/press` (short, brand-forward, immediately understood, and doesn't
 * collide) inside a new `(public)` route group — not implemented here.
 */
export function MediaKitOverviewView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function applyResult(result: Awaited<ReturnType<typeof getMediaKitOverviewData>>) {
    if (!result.success) {
      setState({ status: "error" });
      return;
    }
    if (result.data === null) {
      setState({ status: "not_configured" });
      return;
    }
    setState({ status: "ready", data: result.data });
  }

  const load = () => {
    setState({ status: "loading" });
    getMediaKitOverviewData()
      .then(applyResult)
      .catch(() => setState({ status: "error" }));
  };

  useEffect(() => {
    let cancelled = false;
    getMediaKitOverviewData()
      .then((result) => {
        if (cancelled) return;
        applyResult(result);
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // MEDIAKIT-02.1 — the one explicit creation entry point. Guards against
  // double submission with the `creating` flag (the button is also
  // disabled while true); on success it re-runs the same real read path
  // (`load`) rather than fabricating a ready state client-side, so the
  // Overview that appears is always genuinely persisted data.
  const handleCreate = () => {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    createMediaKitAction()
      .then((result) => {
        setCreating(false);
        if (!result.success) {
          setCreateError(result.error);
          return;
        }
        load();
      })
      .catch(() => {
        setCreating(false);
        setCreateError("Something went wrong creating your Media Kit. Please try again.");
      });
  };

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="The Media Kit isn't available." onRetry={load} />;
  }

  if (state.status === "not_configured") {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <ModuleHero
          eyebrow="Business"
          title="Media Kit"
          purpose="Manage your public Amoré Bloom media presence."
          breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Media Kit" }]}
        />

        <Card className="mx-auto flex max-w-xl flex-col items-center gap-5 px-8 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-100">
            <MediaKitIcon className="h-6 w-6 text-accent" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-text">Create your Amoré Bloom Media Kit</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Build a polished public presentation of your brand, services, portfolio, and selected work — all managed directly from BloomOS.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs text-text-muted sm:grid-cols-2">
            <li>Present the brand</li>
            <li>Feature services</li>
            <li>Curate portfolio work</li>
            <li>Share a public page</li>
            <li>Receive inquiries</li>
            <li>Track views and conversions</li>
          </ul>

          <Button type="button" variant="primary" onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create Media Kit"}
          </Button>

          {createError ? (
            <p role="alert" className="text-xs text-danger">
              {createError}
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  const { data } = state;
  const { mediaKit, contentStatus, analytics, recentActivity } = data;

  const statusLabel = mediaKit.status === "published" ? "Published" : mediaKit.status === "unpublished" ? "Unpublished" : "Draft";
  const statusTone = mediaKit.status === "published" ? "success" : mediaKit.status === "unpublished" ? "warning" : "neutral";
  const publishDisabledReason =
    mediaKit.status === "published"
      ? "Already published — republishing arrives in a later Media Kit checkpoint."
      : "Publishing becomes available once your Media Kit has content and a dedicated publish workflow — coming in a later Media Kit checkpoint.";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModuleHero
        eyebrow="Business"
        title="Media Kit"
        purpose="Manage your public Amoré Bloom media presence."
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Media Kit" }]}
        actions={
          <Button type="button" variant="primary" disabled title={publishDisabledReason}>
            Publish
          </Button>
        }
      />

      <Tabs defaultValue="overview">
        <TabList aria-label="Media Kit sections" className="flex-wrap">
          <Tab value="overview">Overview</Tab>
          <Tab value="brand">Brand</Tab>
          <Tab value="services">Services</Tab>
          <Tab value="portfolio">Portfolio</Tab>
          <Tab value="partners">Partners</Tab>
          <Tab value="testimonials">Testimonials</Tab>
          <Tab value="press">Press</Tab>
          <Tab value="metrics">Metrics</Tab>
          <Tab value="social">Social</Tab>
          <Tab value="gallery">Gallery</Tab>
          <Tab value="contact">Contact &amp; CTA</Tab>
          <Tab value="appearance">Appearance</Tab>
          <Tab value="publish">Publish</Tab>
        </TabList>

        <TabPanel value="overview" className="mt-6 space-y-6">
          <section aria-label="Performance">
            <h2 className="font-serif text-lg text-text">Performance</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card>
                <p className="text-[10px] tracking-[0.1em] text-accent uppercase">Views</p>
                <p className="mt-0.5 font-serif text-2xl font-semibold tabular-nums text-text">{analytics.totalViews}</p>
              </Card>
              <Card>
                <p className="text-[10px] tracking-[0.1em] text-accent uppercase">Approx. Unique Visitors</p>
                <p className="mt-0.5 font-serif text-2xl font-semibold tabular-nums text-text">{analytics.approxUniqueVisitors}</p>
              </Card>
              <Card>
                <p className="text-[10px] tracking-[0.1em] text-accent uppercase">Inquiries</p>
                <p className="mt-0.5 font-serif text-2xl font-semibold tabular-nums text-text">{analytics.inquiries}</p>
              </Card>
              <Card>
                <p className="text-[10px] tracking-[0.1em] text-accent uppercase">Leads Generated</p>
                <p className="mt-0.5 font-serif text-2xl font-semibold tabular-nums text-text">{analytics.leadsGenerated}</p>
              </Card>
            </div>
          </section>

          <section aria-label="Content status">
            <h2 className="font-serif text-lg text-text">Content</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SECTION_KEYS.map((key) => (
                <Card key={key} className="flex items-center justify-between">
                  <span className="text-sm text-text">{SECTION_LABELS[key]}</span>
                  <ReadinessBadge readiness={contentStatus[key as keyof MediaKitContentStatus]} />
                </Card>
              ))}
            </div>
          </section>

          <section aria-label="Recent activity">
            <h2 className="font-serif text-lg text-text">Recent activity</h2>
            {recentActivity.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No activity yet" description="Once your Media Kit is published, views and inquiries will appear here." />
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between border-b border-border/60 pb-2 text-sm last:border-0">
                    <span className="text-text">{ACTIVITY_LABELS[entry.eventType]}</span>
                    <span className="text-xs text-text-muted">{new Date(entry.occurredAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Publication">
            <h2 className="font-serif text-lg text-text">Publication</h2>
            <Card className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone}>{statusLabel}</Badge>
                  {mediaKit.published_at ? (
                    <span className="text-xs text-text-muted">Last published {new Date(mediaKit.published_at).toLocaleDateString()}</span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs text-text-muted">Public page not yet available — the public Media Kit ships in a later checkpoint.</p>
              </div>
            </Card>
          </section>
        </TabPanel>

        <TabPanel value="brand" className="mt-6">
          <ComingSoonSection {...SECTION_COPY.brand} note="Brand editing begins in the next Media Kit checkpoint." />
        </TabPanel>
        <TabPanel value="services" className="mt-6">
          <ComingSoonSection {...SECTION_COPY.services} note="Services curation begins in the next Media Kit checkpoint." />
        </TabPanel>
        <TabPanel value="portfolio" className="mt-6">
          <ComingSoonSection {...SECTION_COPY.portfolio} note="Portfolio curation begins in a future Media Kit checkpoint." />
        </TabPanel>
        <TabPanel value="partners" className="mt-6">
          <ComingSoonSection {...SECTION_COPY.partners} note="Partners curation begins in a future Media Kit checkpoint." />
        </TabPanel>
        <TabPanel value="testimonials" className="mt-6">
          <ComingSoonSection {...SECTION_COPY.testimonials} note="Testimonials begin in a future Media Kit checkpoint." />
        </TabPanel>
        <TabPanel value="press" className="mt-6">
          <ComingSoonSection {...SECTION_COPY.press} note="Press begins in a future Media Kit checkpoint." />
        </TabPanel>

        <TabPanel value="metrics" className="mt-6 space-y-3">
          <p className="max-w-2xl text-sm text-text-muted">
            The full Media Kit Analytics dashboard — trends, traffic sources, and Lead/Client/Contract attribution — arrives in a later checkpoint. For
            now, here is the real, current summary.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <p className="text-[10px] tracking-[0.1em] text-accent uppercase">Views</p>
              <p className="mt-0.5 font-serif text-2xl font-semibold tabular-nums text-text">{analytics.totalViews}</p>
            </Card>
            <Card>
              <p className="text-[10px] tracking-[0.1em] text-accent uppercase">Approx. Unique Visitors</p>
              <p className="mt-0.5 font-serif text-2xl font-semibold tabular-nums text-text">{analytics.approxUniqueVisitors}</p>
            </Card>
            <Card>
              <p className="text-[10px] tracking-[0.1em] text-accent uppercase">Inquiries</p>
              <p className="mt-0.5 font-serif text-2xl font-semibold tabular-nums text-text">{analytics.inquiries}</p>
            </Card>
            <Card>
              <p className="text-[10px] tracking-[0.1em] text-accent uppercase">Leads Generated</p>
              <p className="mt-0.5 font-serif text-2xl font-semibold tabular-nums text-text">{analytics.leadsGenerated}</p>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="social" className="mt-6">
          <ComingSoonSection
            title="Add your social links"
            description="Connect the channels people can find you on."
            note="Social linking begins in a future Media Kit checkpoint."
          />
        </TabPanel>
        <TabPanel value="gallery" className="mt-6">
          <ComingSoonSection {...SECTION_COPY.gallery} note="Gallery curation begins in a future Media Kit checkpoint." />
        </TabPanel>
        <TabPanel value="contact" className="mt-6">
          <ComingSoonSection {...SECTION_COPY.contact} note="Contact & CTA setup begins in a future Media Kit checkpoint." />
        </TabPanel>
        <TabPanel value="appearance" className="mt-6">
          <ComingSoonSection
            title="Choose your Media Kit's presentation"
            description="Select a hero image and light presentation preferences, within Amoré Bloom's existing design language."
            note="Appearance settings begin in a future Media Kit checkpoint."
          />
        </TabPanel>

        <TabPanel value="publish" className="mt-6 space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone}>{statusLabel}</Badge>
                {mediaKit.published_at ? (
                  <span className="text-xs text-text-muted">Last published {new Date(mediaKit.published_at).toLocaleDateString()}</span>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs text-text-muted">Public page not yet available — the public Media Kit ships in a later checkpoint.</p>
            </div>
            <Button type="button" variant="primary" disabled title={publishDisabledReason}>
              Publish
            </Button>
          </Card>
          <p className="max-w-2xl text-xs text-text-muted">{publishDisabledReason}</p>
        </TabPanel>
      </Tabs>
    </div>
  );
}
