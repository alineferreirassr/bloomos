import { listSettingsForWorkspace, listSettingsSectionsForWorkspace, type SettingsVisibilityContext } from "@/core/settings/discovery";

/**
 * Step 14's own Global Settings Search. Typing "timezone," "invoice,"
 * "approval," or "provider" should land a member on the right Section —
 * this is the ranking behind that. Reuses `listSettingsForWorkspace`/
 * `listSettingsSectionsForWorkspace` so a search result can never surface a
 * Setting or Section the member isn't otherwise permitted to see (Step 18's
 * own "Permission aware. Role aware. Section aware. Feature Flag aware,"
 * applied here too, not just to the page itself).
 */
export interface SettingsSearchResult {
  kind: "setting" | "section";
  /** The Setting id if `kind === "setting"`, otherwise the Section id. */
  id: string;
  /** The Section a match should navigate to — itself, if `kind === "section"`. */
  sectionId: string;
  label: string;
  description: string;
  score: number;
}

function scoreMatch(query: string, label: string, description: string, keywords: string[], id: string): number {
  const normalizedLabel = label.toLowerCase();
  const normalizedDescription = description.toLowerCase();
  const normalizedId = id.toLowerCase();

  let best = 0;
  if (normalizedLabel === query) best = Math.max(best, 100);
  else if (normalizedLabel.startsWith(query)) best = Math.max(best, 90);
  else if (normalizedLabel.includes(query)) best = Math.max(best, 70);

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    if (normalizedKeyword === query) best = Math.max(best, 95);
    else if (normalizedKeyword.includes(query)) best = Math.max(best, 65);
  }

  if (normalizedId.includes(query)) best = Math.max(best, 55);
  if (normalizedDescription.includes(query)) best = Math.max(best, 30);

  return best;
}

/**
 * Ranked search across every visible Section and Setting. An empty or
 * whitespace-only query returns no results — Search is for narrowing, not
 * for browsing (the Section nav already covers that). Results cap at 20 so
 * a broad query like "e" still returns something useful rather than a wall
 * of near-zero-relevance matches.
 */
export async function searchSettings(query: string, context: SettingsVisibilityContext): Promise<SettingsSearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const [sections, settings] = await Promise.all([listSettingsSectionsForWorkspace(context), listSettingsForWorkspace(context)]);

  const results: SettingsSearchResult[] = [];

  for (const section of sections) {
    const score = scoreMatch(normalizedQuery, section.label, section.description, [], section.id);
    if (score > 0) {
      results.push({ kind: "section", id: section.id, sectionId: section.id, label: section.label, description: section.description, score });
    }
  }

  for (const setting of settings) {
    const score = scoreMatch(normalizedQuery, setting.label, setting.description, setting.keywords, setting.id);
    if (score > 0) {
      results.push({ kind: "setting", id: setting.id, sectionId: setting.sectionId, label: setting.label, description: setting.description, score });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, 20);
}

export type { SettingsVisibilityContext };
