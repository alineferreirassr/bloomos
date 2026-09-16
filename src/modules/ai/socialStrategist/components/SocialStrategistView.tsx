"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { registerSkillRunner, unregisterSkillRunner } from "@/core/ai/skills/runnerRegistry";
import { generateSocialStrategistBrief } from "@/modules/ai/socialStrategist/generateSocialStrategistBrief";
import { SOCIAL_STRATEGIST_SKILL_ID } from "@/modules/ai/socialStrategist/registerSocialStrategistSkill";
import type {
  GeneratedSocialStrategistBrief,
} from "@/modules/ai/socialStrategist/generateSocialStrategistBrief";
import type {
  SocialStrategistBrief,
  SocialStrategistResolvedContentOpportunity,
  SocialStrategistResolvedNextContentRecommendation,
  SocialStrategistResolvedReference,
} from "@/modules/ai/socialStrategist/assembleSocialStrategistBrief";

type ViewStatus = "idle" | "loading" | "success" | "error";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toPlainText(result: GeneratedSocialStrategistBrief): string {
  const { brief } = result;
  const lines: string[] = ["SOCIAL STRATEGIST REPORT", formatDateTime(result.generatedAt), ""];

  if (brief.accountObservations.length > 0) {
    lines.push("ACCOUNT & PERFORMANCE OBSERVATIONS", ...brief.accountObservations.map((line) => `- ${line}`), "");
  }
  if (brief.contentOpportunities.length > 0) {
    lines.push("CONTENT OPPORTUNITIES", ...brief.contentOpportunities.map((item) => `- ${item.label}: ${item.reason}`), "");
  }
  if (brief.contentPillars.length > 0) {
    lines.push("CONTENT PILLARS", ...brief.contentPillars.map((item) => `- ${item.name}: ${item.rationale}`), "");
  }
  if (brief.nextContentRecommendations.length > 0) {
    lines.push("NEXT CONTENT RECOMMENDATIONS", ...brief.nextContentRecommendations.map((item) => `- ${item.label}: ${item.reason}`), "");
  }
  if (brief.postingStrategyNotes.length > 0) {
    lines.push("POSTING STRATEGY", ...brief.postingStrategyNotes.map((line) => `- ${line}`), "");
  }
  if (brief.audienceObservations.length > 0) {
    lines.push("AUDIENCE OBSERVATIONS", ...brief.audienceObservations.map((line) => `- ${line}`), "");
  }
  if (brief.conversionObservations.length > 0) {
    lines.push("CONVERSION OBSERVATIONS", ...brief.conversionObservations.map((line) => `- ${line}`), "");
  }
  if (brief.dataGaps.length > 0) {
    lines.push("DATA GAPS", ...brief.dataGaps.map((line) => `- ${line}`), "");
  }
  return lines.join("\n").trim();
}

/**
 * SOCIAL-14D — the AI Social Strategist's own dedicated page, mirroring
 * `CRMAssistantView.tsx`'s exact pattern: a standalone route, a Server
 * Action wrapper as the only Skill entry point, and a plain string-union
 * `ViewStatus` state machine. Never imports the provider registry or a
 * provider implementation directly — every action here calls
 * `generateSocialStrategistBrief()`, a `"use server"` Server Action, the
 * only place `executeSkill()` is ever invoked (see that file for why no
 * real AI provider is configured this checkpoint). This view never fetches
 * additional data of its own — everything it renders comes from the one
 * `SocialStrategistBrief` the Server Action returns, itself built entirely
 * from SOCIAL-14C's validated, PII-minimized structured output.
 */
export function SocialStrategistView() {
  const [status, setStatus] = useState<ViewStatus>("idle");
  const [result, setResult] = useState<GeneratedSocialStrategistBrief | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function handleGenerate() {
    if (status === "loading") return; // duplicate-submit prevention
    setStatus("loading");
    setErrorMessage(null);

    const outcome = await generateSocialStrategistBrief();
    if (!outcome.success) {
      setStatus("error");
      setErrorMessage(outcome.error);
      return;
    }
    setResult(outcome.data);
    setStatus("success");
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(toPlainText(result));
    setCopyToast(true);
  }

  const handleGenerateRef = useRef(handleGenerate);
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  // Lets the "Ask Bloom" Skill Picker run this page's own generation while
  // this page is mounted — same pattern `CRMAssistantView`/`FinanceAssistantView`
  // already established for their own Skills.
  useEffect(() => {
    registerSkillRunner(SOCIAL_STRATEGIST_SKILL_ID, () => {
      headingRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      headingRef.current?.focus();
      return handleGenerateRef.current();
    });
    return () => unregisterSkillRunner(SOCIAL_STRATEGIST_SKILL_ID);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-3xl font-semibold text-text">
            Social Strategist
          </h2>
          <p className="mt-2 max-w-prose text-sm text-text-muted">
            Bloom AI reads this Workspace&apos;s own Social posts, Instagram analytics, Ideas/Inspiration/Scripts/Carousels
            libraries, and Instagram-sourced Leads to surface content opportunities, pillars, and next-content
            recommendations. It never reads raw Instagram comments, DMs, or Lead messages, never invents a follower
            count or trend, and never posts or changes anything — review every suggestion before acting on it.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleGenerate}
          disabled={status === "loading"}
          aria-label={result ? "Refresh Social Strategist report" : "Generate Social Strategist report"}
        >
          {status === "loading" ? "Generating…" : result ? "Refresh" : "Generate"}
        </Button>
      </div>

      <div aria-live="polite">
        {status === "loading" ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        {status === "error" && errorMessage ? (
          <div role="alert" className="rounded-md border border-danger/60 bg-danger/10 px-4 py-2 text-sm text-danger">
            {errorMessage}
            <Button type="button" variant="ghost" onClick={handleGenerate} className="ml-2">
              Try again
            </Button>
          </div>
        ) : null}

        {status === "idle" ? <p className="text-sm text-text/55">No Social Strategist report has been generated yet.</p> : null}

        {status === "success" && result ? <SocialStrategistReport result={result} onCopy={handleCopy} /> : null}
      </div>

      {copyToast ? <Toast tone="success" message="Social Strategist report copied to clipboard." onDismiss={() => setCopyToast(false)} /> : null}
    </div>
  );
}

function SocialStrategistReport({ result, onCopy }: { result: GeneratedSocialStrategistBrief; onCopy: () => void }) {
  const { brief } = result;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span>Generated {formatDateTime(result.generatedAt)}</span>
        <Badge tone={result.mock ? "outline" : "accent"}>{result.mock ? "Development mock — not a real AI call" : "AI-generated"}</Badge>
        <span>Confidence: {brief.confidence}%</span>
        <Button type="button" variant="ghost" onClick={onCopy} aria-label="Copy Social Strategist report as text">
          Copy
        </Button>
      </div>

      {brief.isEmpty ? (
        <EmptyState
          title="No Social Strategist report yet"
          description="Bloom AI didn't find enough Social data in this Workspace to generate observations or recommendations yet. Publish a post, add an Idea, or connect an Instagram account, then generate again."
        />
      ) : (
        <>
          <section aria-labelledby="social-strategist-observations-heading" className="space-y-4">
            <h3 id="social-strategist-observations-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Data &amp; Observations
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ObservationCard title="Account &amp; Performance" headingId="social-strategist-account-heading" items={brief.accountObservations} emptyLabel="No account or performance observations yet." />
              <ObservationCard title="Posting Strategy" headingId="social-strategist-posting-heading" items={brief.postingStrategyNotes} emptyLabel="No posting strategy notes yet." />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {brief.audienceObservations.length > 0 ? (
                <ObservationCard title="Audience" headingId="social-strategist-audience-heading" items={brief.audienceObservations} emptyLabel="" />
              ) : null}
              {brief.conversionObservations.length > 0 ? (
                <ObservationCard title="Conversion &amp; Instagram Leads" headingId="social-strategist-conversion-heading" items={brief.conversionObservations} emptyLabel="" />
              ) : null}
            </div>
            <ReferencedContentCard references={brief.referencedContent} />
          </section>

          <section aria-labelledby="social-strategist-recommendations-heading" className="space-y-4">
            <h3 id="social-strategist-recommendations-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Recommendations
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ContentOpportunitiesCard opportunities={brief.contentOpportunities} />
              <ContentPillarsCard pillars={brief.contentPillars} />
            </div>
            <NextContentRecommendationsCard recommendations={brief.nextContentRecommendations} />
          </section>

          <DataGapsCard brief={brief} />
        </>
      )}
    </div>
  );
}

function ObservationCard({ title, headingId, items, emptyLabel }: { title: string; headingId: string; items: string[]; emptyLabel: string }) {
  return (
    <LuxuryCard>
      <h4 id={headingId} className="font-serif text-[17px] font-semibold text-text">
        {title}
      </h4>
      {items.length === 0 ? (
        emptyLabel ? <p className="mt-2 text-sm text-text/55">{emptyLabel}</p> : null
      ) : (
        <ul className="mt-3 space-y-2" aria-labelledby={headingId}>
          {items.map((item) => (
            <li key={item} className="text-sm text-text">
              {item}
            </li>
          ))}
        </ul>
      )}
    </LuxuryCard>
  );
}

function ContentOpportunitiesCard({ opportunities }: { opportunities: SocialStrategistResolvedContentOpportunity[] }) {
  return (
    <LuxuryCard>
      <h4 id="social-strategist-opportunities-heading" className="font-serif text-[17px] font-semibold text-text">
        Content Opportunities
      </h4>
      {opportunities.length === 0 ? (
        <p className="mt-2 text-sm text-text/55">No content opportunities surfaced right now.</p>
      ) : (
        <ul className="mt-3 space-y-2.5" aria-labelledby="social-strategist-opportunities-heading">
          {opportunities.map((opportunity, index) => (
            <li key={`${opportunity.label}-${index}`} className="text-sm text-text">
              <p className="font-medium">{opportunity.label}</p>
              <p className="text-text-muted">{opportunity.reason}</p>
              <div className="mt-1 flex flex-wrap gap-3">
                {opportunity.relatedPost ? (
                  <Link href={opportunity.relatedPost.href} className="text-xs font-medium text-accent hover:underline">
                    Based on: {opportunity.relatedPost.title}
                  </Link>
                ) : null}
                {opportunity.relatedIdea ? (
                  <Link href={opportunity.relatedIdea.href} className="text-xs font-medium text-accent hover:underline">
                    Related Idea: {opportunity.relatedIdea.title}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </LuxuryCard>
  );
}

function ContentPillarsCard({ pillars }: { pillars: SocialStrategistBrief["contentPillars"] }) {
  return (
    <LuxuryCard>
      <h4 id="social-strategist-pillars-heading" className="font-serif text-[17px] font-semibold text-text">
        Content Pillars
      </h4>
      {pillars.length === 0 ? (
        <p className="mt-2 text-sm text-text/55">No content pillars identified yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5" aria-labelledby="social-strategist-pillars-heading">
          {pillars.map((pillar) => (
            <li key={pillar.name} className="text-sm text-text">
              <Badge tone="outline">{pillar.name}</Badge>
              <p className="mt-1 text-text-muted">{pillar.rationale}</p>
            </li>
          ))}
        </ul>
      )}
    </LuxuryCard>
  );
}

function NextContentRecommendationsCard({ recommendations }: { recommendations: SocialStrategistResolvedNextContentRecommendation[] }) {
  return (
    <LuxuryCard>
      <h4 id="social-strategist-next-content-heading" className="font-serif text-[17px] font-semibold text-text">
        Next Content Recommendations
      </h4>
      {recommendations.length === 0 ? (
        <p className="mt-2 text-sm text-text/55">No next-content recommendations right now.</p>
      ) : (
        <ul className="mt-3 space-y-2.5" aria-labelledby="social-strategist-next-content-heading">
          {recommendations.map((recommendation, index) => (
            <li key={`${recommendation.label}-${index}`} className="text-sm text-text">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{recommendation.label}</p>
                {recommendation.suggestedFormat ? <Badge tone="neutral">{recommendation.suggestedFormat}</Badge> : null}
              </div>
              <p className="text-text-muted">{recommendation.reason}</p>
              <div className="mt-1 flex flex-wrap gap-3">
                {recommendation.relatedIdea ? (
                  <Link href={recommendation.relatedIdea.href} className="text-xs font-medium text-accent hover:underline">
                    Related Idea: {recommendation.relatedIdea.title}
                  </Link>
                ) : null}
                {recommendation.relatedInspiration ? (
                  <Link href={recommendation.relatedInspiration.href} className="text-xs font-medium text-accent hover:underline">
                    Related Inspiration: {recommendation.relatedInspiration.title}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </LuxuryCard>
  );
}

function ReferencedContentCard({ references }: { references: SocialStrategistResolvedReference[] }) {
  if (references.length === 0) return null;
  return (
    <LuxuryCard>
      <h4 id="social-strategist-referenced-content-heading" className="font-serif text-[17px] font-semibold text-text">
        Referenced Content
      </h4>
      <ul className="mt-3 space-y-2" aria-labelledby="social-strategist-referenced-content-heading">
        {references.map((reference) => (
          <li key={`${reference.type}-${reference.id}`} className="text-sm text-text">
            <Link href={reference.href} className="font-medium text-accent hover:underline">
              {reference.title}
            </Link>
            <p className="text-text-muted">{reference.note}</p>
          </li>
        ))}
      </ul>
    </LuxuryCard>
  );
}

const UNAVAILABLE_CATEGORY_LABEL: Record<string, string> = {
  posts: "Social posts",
  postMetrics: "Post analytics",
  accountMetrics: "Instagram account analytics",
  ideas: "Ideas",
  inspiration: "Inspiration",
  scripts: "Scripts",
  carousels: "Carousels",
  instagramLeads: "Instagram-sourced Leads",
};

/** The structured "absence/uncertainty" state, kept visually distinct from both facts and recommendations above — never rendered as a zero or silently omitted. Hidden entirely when there's genuinely nothing to disclose. */
function DataGapsCard({ brief }: { brief: SocialStrategistBrief }) {
  if (brief.dataGaps.length === 0 && brief.unavailableCategories.length === 0) return null;
  return (
    <LuxuryCard className="border-warning/40 bg-warning/5">
      <div className="flex items-center gap-2">
        <h4 id="social-strategist-data-gaps-heading" className="font-serif text-[17px] font-semibold text-text">
          Data Gaps
        </h4>
        <Badge tone="warning">Incomplete</Badge>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        This report reflects only the real data available right now — nothing below was estimated or assumed.
      </p>
      <ul className="mt-3 list-inside list-disc text-sm text-text" aria-labelledby="social-strategist-data-gaps-heading">
        {brief.unavailableCategories.map((category) => (
          <li key={category}>{UNAVAILABLE_CATEGORY_LABEL[category] ?? category} couldn&apos;t be read for this report.</li>
        ))}
        {brief.dataGaps.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </LuxuryCard>
  );
}
