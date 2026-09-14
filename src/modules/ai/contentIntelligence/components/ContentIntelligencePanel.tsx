"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDateOnly } from "@/lib/dateFormat";
import { analyzeContentAction } from "@/modules/ai/contentIntelligence/analyzeContentAction";
import { listAIGenerationsAction, approveAIGenerationAction, rejectAIGenerationAction } from "@/modules/aiGeneration/aiGenerationActions";
import { contentIntelligenceBriefOutputSchema } from "@/modules/ai/contentIntelligence/schema";
import { CONTENT_INTELLIGENCE_USE_CASE_ID } from "@/modules/ai/contentIntelligence/promptBuilder";
import type { AIGeneration, AIGenerationSourceEntityType, AIGenerationApprovalStatus } from "@/types/aiGeneration";
import type { ContentIntelligenceBriefOutput } from "@/modules/ai/contentIntelligence/types";

interface ContentIntelligencePanelProps {
  sourceEntityType: AIGenerationSourceEntityType;
  sourceEntityId: string;
  /** Whether the caller holds social.create — Generate/Regenerate/Approve/Reject are hidden, not merely disabled, for a read-only viewer. The Server Actions themselves are still the real enforcement boundary. */
  canManage: boolean;
  /**
   * True when the source Idea/Inspiration/Script is archived. Hides the
   * Generate/Regenerate control here, matching every other write-adjacent
   * control's own `canManage && !isArchived` convention in this codebase
   * (e.g. `ScriptBlockEditor`'s own `canManage`). This is a UI-only
   * affordance — `analyzeContentAction` itself still permits analysis of
   * archived content by design (SOCIAL-09C's own considered decision,
   * unchanged here), so history/viewing/approval remain fully available
   * regardless of this flag.
   */
  sourceArchived: boolean;
}

type HistoryState = { status: "loading" } | { status: "error" } | { status: "ready"; generations: AIGeneration[] };

const APPROVAL_BADGE_TONE: Record<AIGenerationApprovalStatus, "neutral" | "success" | "danger"> = {
  proposed: "neutral",
  approved: "success",
  rejected: "danger",
};

const APPROVAL_LABEL: Record<AIGenerationApprovalStatus, string> = {
  proposed: "AI suggestion — not reviewed",
  approved: "Approved by a team member",
  rejected: "Rejected by a team member",
};

/**
 * SOCIAL-09D — the one shared UI surface for the SOCIAL-09C Content Brief
 * capability, embedded as a new section inside the existing Idea/
 * Inspiration/Script detail dialogs rather than a new dedicated dialog or
 * dashboard (see each dialog's own integration for the placement
 * reasoning). Backend-authoritative like every other list/detail view in
 * this codebase: reloads history from `listAIGenerationsAction` rather than
 * trusting locally-mutated state to stay in sync with the server. Every
 * text field is rendered as plain React text content — never
 * `dangerouslySetInnerHTML` — so nothing here can execute markup even if a
 * future provider's output somehow contained it (the server's own
 * `contentIntelligenceBriefOutputSchema` already rejects HTML-shaped output
 * before it can ever be persisted).
 */
export function ContentIntelligencePanel({ sourceEntityType, sourceEntityId, canManage, sourceArchived }: ContentIntelligencePanelProps) {
  const [wasSourceId, setWasSourceId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  /** SOCIAL-09D — guards against a stale history/analysis response (for a source the user has since switched away from) overwriting the currently-viewed source's state, mirroring `ScriptDetailDialog`'s own `latestVersionsRequestIdRef` pattern. `loadHistory` bumps its own ref every time it runs (including from the effect below on every source change), so a stale history response for a previous source is already excluded; the effect below additionally bumps the analyze ref on every source change, so an in-flight analysis for the *previous* source can never apply even if the user never triggers a new one for the new source. */
  const latestHistoryRequestIdRef = useRef(0);
  const latestAnalyzeRequestIdRef = useRef(0);

  if (sourceEntityId !== wasSourceId) {
    setWasSourceId(sourceEntityId);
    setHistory({ status: "loading" });
    setSelectedId(null);
    setAnalyzing(false);
    setAnalyzeError(null);
    setReviewBusy(false);
    setReviewError(null);
  }

  function loadHistory(forSourceId: string) {
    const requestId = ++latestHistoryRequestIdRef.current;
    listAIGenerationsAction({ source_entity_type: sourceEntityType, source_entity_id: forSourceId, use_case_id: CONTENT_INTELLIGENCE_USE_CASE_ID }).then((result) => {
      if (requestId !== latestHistoryRequestIdRef.current) return;
      if (!result.success) {
        setHistory({ status: "error" });
        return;
      }
      setHistory({ status: "ready", generations: result.data });
      setSelectedId((prev) => prev ?? result.data[0]?.id ?? null);
    });
  }

  useEffect(() => {
    latestAnalyzeRequestIdRef.current++;
    loadHistory(sourceEntityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the source entity itself changes, matching every other list view's own [dependency] shape in this codebase
  }, [sourceEntityId]);

  async function handleAnalyze() {
    if (analyzing) return;
    const requestId = ++latestAnalyzeRequestIdRef.current;
    const forSourceId = sourceEntityId;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeContentAction({ source_entity_type: sourceEntityType, source_entity_id: forSourceId });
      if (requestId !== latestAnalyzeRequestIdRef.current) return;
      if (!result.success) {
        setAnalyzeError(result.error);
        return;
      }
      setSelectedId(result.data.id);
      loadHistory(forSourceId);
    } catch {
      if (requestId === latestAnalyzeRequestIdRef.current) setAnalyzeError("Something went wrong. Please try again.");
    } finally {
      if (requestId === latestAnalyzeRequestIdRef.current) setAnalyzing(false);
    }
  }

  async function handleReview(action: "approve" | "reject") {
    if (!selectedId || reviewBusy) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const result = action === "approve" ? await approveAIGenerationAction(selectedId) : await rejectAIGenerationAction(selectedId);
      if (!result.success) {
        setReviewError(result.error);
        return;
      }
      setHistory((prev) => (prev.status === "ready" ? { status: "ready", generations: prev.generations.map((g) => (g.id === result.data.id ? result.data : g)) } : prev));
    } catch {
      setReviewError("Something went wrong. Please try again.");
    } finally {
      setReviewBusy(false);
    }
  }

  const selectedGeneration = history.status === "ready" ? (history.generations.find((g) => g.id === selectedId) ?? null) : null;
  const parsedOutput = selectedGeneration ? contentIntelligenceBriefOutputSchema.safeParse(selectedGeneration.output) : null;

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-muted">Content Intelligence</p>
        {canManage && !sourceArchived ? (
          <Button type="button" variant="secondary" onClick={handleAnalyze} disabled={analyzing} aria-busy={analyzing}>
            {analyzing ? "Generating…" : history.status === "ready" && history.generations.length > 0 ? "Regenerate brief" : "Generate brief"}
          </Button>
        ) : null}
      </div>

      {analyzeError ? (
        <p role="alert" className="mb-2 text-sm text-rose-600 dark:text-rose-400">
          {analyzeError}
        </p>
      ) : null}

      {history.status === "loading" ? <p className="text-xs text-text-muted">Loading content intelligence…</p> : null}
      {history.status === "error" ? <ErrorState message="Could not load content intelligence." onRetry={() => loadHistory(sourceEntityId)} /> : null}

      {history.status === "ready" && history.generations.length === 0 ? (
        <p className="text-xs text-text-muted">No AI content brief has been generated for this item yet.</p>
      ) : null}

      {history.status === "ready" && history.generations.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Generation history">
            {history.generations.map((generation) => (
              <button
                key={generation.id}
                type="button"
                role="tab"
                aria-selected={generation.id === selectedId}
                onClick={() => setSelectedId(generation.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  generation.id === selectedId ? "border-accent bg-accent/8 text-text" : "border-border text-text-muted"
                }`}
              >
                Brief #{generation.generation_number}
              </button>
            ))}
          </div>

          {selectedGeneration ? (
            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={APPROVAL_BADGE_TONE[selectedGeneration.approval_status]}>{APPROVAL_LABEL[selectedGeneration.approval_status]}</Badge>
                <span className="text-xs text-text-muted">
                  Generated {formatDateOnly(selectedGeneration.created_at)}
                  {selectedGeneration.confidence !== null ? ` · Confidence ${selectedGeneration.confidence}%` : ""}
                </span>
              </div>

              <p className="text-xs text-text-muted">This is an AI-generated suggestion. Nothing below is applied automatically — review it, then approve or reject.</p>

              {parsedOutput?.success ? (
                <ContentBriefView output={parsedOutput.data} />
              ) : (
                <p className="text-sm text-text-muted">This result couldn&apos;t be displayed — it may be from an older or unsupported format.</p>
              )}

              {reviewError ? (
                <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
                  {reviewError}
                </p>
              ) : null}

              {canManage && selectedGeneration.approval_status === "proposed" ? (
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => handleReview("reject")} disabled={reviewBusy} aria-busy={reviewBusy}>
                    Reject
                  </Button>
                  <Button type="button" onClick={() => handleReview("approve")} disabled={reviewBusy} aria-busy={reviewBusy}>
                    Approve
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ContentBriefView({ output }: { output: ContentIntelligenceBriefOutput }) {
  return (
    <div className="flex flex-col gap-2.5">
      <BriefField label="Summary" value={output.summary} />
      <BriefListField label="Hook suggestions" values={output.hookSuggestions} />
      <BriefListField label="CTA suggestions" values={output.ctaSuggestions} />
      <BriefField label="Audience observations" value={output.audienceObservations} />
      <BriefListField label="Strengths" values={output.strengths} />
      <BriefListField label="Gaps" values={output.gaps} />
      <BriefListField label="Recommendations" values={output.recommendations} />
    </div>
  );
}

function BriefField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-text">{value}</p>
    </div>
  );
}

function BriefListField({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-sm text-text">
        {values.map((value, index) => (
          <li key={index}>{value}</li>
        ))}
      </ul>
    </div>
  );
}
