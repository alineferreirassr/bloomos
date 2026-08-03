import type { ActivityEntry } from "@/types/communication";
import type { JourneyBlocker, JourneyContext, JourneyStage, NextBestAction } from "@/types/clientJourney";
import { JOURNEY_STAGE_DEFAULT_LABELS } from "@/types/clientJourney";

/**
 * v2.0 Checkpoint 32 — Journey Context Builder (Step 22). Assembles the
 * deterministic Bloom AI context bundle purely from figures every other
 * engine in this checkpoint already computed — no new calculation, no
 * external AI call, no invented fact. Registered as an `AIContextBuilder`
 * in the module layer (`modules/ai/contextBuilders/clientJourneyContextBuilder.ts`),
 * the same pattern every other checkpoint's own context builder follows.
 */

const RECENT_ACTIVITY_LIMIT = 5;

export interface JourneyContextSourceData {
  currentStage: JourneyStage;
  progressPercentage: number;
  blockers: JourneyBlocker[];
  nextBestActions: NextBestAction[];
  recentTimeline: ActivityEntry[];
  relatedCommercialRecords: { type: string; id: string }[];
  relatedOperationalRecords: { type: string; id: string }[];
}

export function computeJourneyContext(data: JourneyContextSourceData): JourneyContext {
  const stageLabel = JOURNEY_STAGE_DEFAULT_LABELS[data.currentStage];
  const journeySummary =
    data.blockers.length === 0
      ? `Currently at '${stageLabel}', ${data.progressPercentage}% through the journey, with no active blockers.`
      : `Currently at '${stageLabel}', ${data.progressPercentage}% through the journey, with ${data.blockers.length} active blocker(s).`;

  const communicationSummary =
    data.recentTimeline.length === 0
      ? "No recent activity recorded."
      : `${data.recentTimeline.length} recent activity item(s), most recently "${data.recentTimeline[0].title}".`;

  return {
    journeySummary,
    currentStage: data.currentStage,
    progressPercentage: data.progressPercentage,
    blockers: data.blockers.map((b) => b.description),
    nextActions: data.nextBestActions.map((a) => a.label),
    recentActivity: data.recentTimeline.slice(0, RECENT_ACTIVITY_LIMIT).map((entry) => entry.title),
    communicationSummary,
    relatedCommercialRecords: data.relatedCommercialRecords,
    relatedOperationalRecords: data.relatedOperationalRecords,
  };
}
