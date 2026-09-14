"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getIdeaItemById, getInspirationItemById, getScriptItemById, listScriptVersions, listScriptBlocks } from "@/lib/data";
import { runContentIntelligenceAnalysis } from "@/modules/ai/contentIntelligence/service";
import { analyzeContentInputSchema } from "@/modules/ai/contentIntelligence/schema";
import type { AIGenerationSourceEntityType, AIGeneration } from "@/types/aiGeneration";
import type { ContentIntelligenceSourceContent } from "@/modules/ai/contentIntelligence/types";

/**
 * SOCIAL-09C — the single Server Action for the AI Content Brief / Content
 * Improvement Analysis capability. Mirrors `scriptActions.ts`/
 * `aiGenerationActions.ts`'s own conventions exactly: its own local
 * `requireActiveSession`/`Result<T>`/`GENERIC_ACCESS_ERROR`, workspace and
 * actor id resolved entirely server-side from `resolveMemberSessionSnapshot()`.
 *
 * READ-ONLY on the source entity: fetches an Idea/Inspiration/Script's own
 * fields for analysis, but never calls an update/mutate function for any of
 * them. The only WRITE this action ever performs is the new
 * `ai_generations` row `runContentIntelligenceAnalysis` persists. No
 * archived-state check exists here deliberately — analyzing an archived
 * Idea/Inspiration/Script never edits it, so this mirrors every other
 * *read* operation in this codebase (e.g. `listScriptBlocksAction`) staying
 * available on archived content, unlike a *write* to the source itself.
 *
 * `social.publish` is never used anywhere in this file.
 */

const GENERIC_ACCESS_ERROR = "That isn't available. You may not have access to it.";
const SOURCE_ENTITY_NOT_FOUND_ERROR = "That source item could not be found.";
const VALIDATION_ERROR = "Please fix the highlighted fields.";

type Result<T> = { success: true; data: T } | { success: false; error: string };

type ActiveSessionResult =
  | { success: false; error: string }
  | { success: true; session: Awaited<ReturnType<typeof resolveMemberSessionSnapshot>> & { kind: "active" } };

async function requireActiveSession(permission: "social.view" | "social.create"): Promise<ActiveSessionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes(permission)) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, session };
}

async function loadIdeaContent(id: string, workspaceId: string): Promise<ContentIntelligenceSourceContent | null> {
  const idea = await getIdeaItemById(id).catch(() => null);
  if (!idea || idea.workspace_id !== workspaceId) return null;

  const fields: Record<string, string> = {};
  if (idea.description) fields.description = idea.description;
  if (idea.hook) fields.hook = idea.hook;
  if (idea.cta) fields.cta = idea.cta;
  if (idea.audience) fields.audience = idea.audience;
  if (idea.notes) fields.notes = idea.notes;

  return { sourceEntityType: "idea_item", sourceEntityId: id, title: idea.title, fields };
}

async function loadInspirationContent(id: string, workspaceId: string): Promise<ContentIntelligenceSourceContent | null> {
  const inspiration = await getInspirationItemById(id).catch(() => null);
  if (!inspiration || inspiration.workspace_id !== workspaceId) return null;

  const fields: Record<string, string> = {};
  if (inspiration.hook) fields.hook = inspiration.hook;
  if (inspiration.cta) fields.cta = inspiration.cta;
  if (inspiration.why_it_works) fields.whyItWorks = inspiration.why_it_works;
  if (inspiration.notes) fields.notes = inspiration.notes;

  return { sourceEntityType: "inspiration_item", sourceEntityId: id, title: inspiration.title, fields };
}

/**
 * Prefers the current draft (the most up-to-date content); falls back to
 * the highest-numbered published version when no draft exists; produces an
 * empty `content` field when the Script has no version at all yet — never
 * a thrown error, matching this codebase's "reads stay available, only
 * writes are gated" convention rather than inventing a new failure mode.
 */
async function loadScriptContent(id: string, workspaceId: string): Promise<ContentIntelligenceSourceContent | null> {
  const script = await getScriptItemById(id).catch(() => null);
  if (!script || script.workspace_id !== workspaceId) return null;

  const versions = await listScriptVersions(id).catch(() => []);
  const draft = versions.find((v) => v.status === "draft");
  const latestPublished = versions
    .filter((v) => v.status === "published")
    .sort((a, b) => (b.version_number ?? 0) - (a.version_number ?? 0))[0];
  const chosenVersion = draft ?? latestPublished ?? null;

  const blocks = chosenVersion ? await listScriptBlocks(chosenVersion.id).catch(() => []) : [];
  const content = blocks
    .map((b) => b.content)
    .join("\n\n")
    .trim();

  const fields: Record<string, string> = {};
  if (content) fields.content = content;

  return { sourceEntityType: "script_item", sourceEntityId: id, title: script.title, fields };
}

/**
 * The polymorphic-reference ownership + content-extraction dispatch — never
 * trusts `sourceEntityId` alone, matching `verifyOwnedSourceEntity` in
 * `aiGenerationActions.ts`. Unlike that helper, this one also returns the
 * entity's own content fields, since the analysis needs them, not just a
 * yes/no ownership answer.
 */
async function loadSourceContent(
  sourceEntityType: AIGenerationSourceEntityType,
  sourceEntityId: string,
  workspaceId: string,
): Promise<ContentIntelligenceSourceContent | null> {
  if (sourceEntityType === "idea_item") return loadIdeaContent(sourceEntityId, workspaceId);
  if (sourceEntityType === "inspiration_item") return loadInspirationContent(sourceEntityId, workspaceId);
  return loadScriptContent(sourceEntityId, workspaceId);
}

export interface AnalyzeContentActionInput {
  source_entity_type: AIGenerationSourceEntityType;
  source_entity_id: string;
}

export async function analyzeContentAction(input: AnalyzeContentActionInput): Promise<Result<AIGeneration>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const parsed = analyzeContentInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  const source = await loadSourceContent(parsed.data.source_entity_type, parsed.data.source_entity_id, resolved.session.workspace.id);
  if (!source) return { success: false, error: SOURCE_ENTITY_NOT_FOUND_ERROR };

  return runContentIntelligenceAnalysis({
    workspaceId: resolved.session.workspace.id,
    createdBy: resolved.session.user.id,
    source,
  });
}
