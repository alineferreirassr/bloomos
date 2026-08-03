import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { buildClientJourney } from "@/modules/clientJourney/clientJourneyActions";
import { JOURNEY_STAGE_DEFAULT_LABELS } from "@/types/clientJourney";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

/**
 * The `"journey"` Merge Field domain (v2 Checkpoint 44) — where a Client
 * currently stands in their Client Journey (Checkpoint 32), resolved via
 * `buildClientJourney()`, the same non-session-gated composer the Client
 * Portal's own journey summary calls — never a second, re-derived journey
 * state. `context.clientId` only; a Lead has no Journey stage yet.
 */
export const journeyMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "journey_stage", label: "Journey Stage", description: "The Client's own current Journey stage.", domain: "journey", valueType: "string", required: false },
  { key: "journey_progress_percent", label: "Journey Progress", description: "The Client's own overall Journey progress, 0-100.", domain: "journey", valueType: "number", required: false },
];

export function registerJourneyMergeFields(): void {
  for (const definition of journeyMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("journey_stage", async (context) => {
    if (!context.clientId) return null;
    const journey = await buildClientJourney(context.workspaceId, "client", context.clientId).catch(() => null);
    return journey ? JOURNEY_STAGE_DEFAULT_LABELS[journey.currentStage] : null;
  });

  registerMergeResolver("journey_progress_percent", async (context) => {
    if (!context.clientId) return null;
    const journey = await buildClientJourney(context.workspaceId, "client", context.clientId).catch(() => null);
    return journey?.progress.overallPercentage ?? null;
  });
}
