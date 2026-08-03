/**
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center. Extends the
 * three-tier scoring convention `workspaceSearchProvider.ts`'s own
 * `scoreTitleMatch` and `core/settings/search.ts`'s own `scoreMatch` already
 * established (exact > prefix > substring) with two more tiers — word-prefix
 * and typo-tolerant fuzzy — so a real provider can opt into "fuzzy search,
 * exact search, prefix search, typo tolerance" without every provider
 * re-inventing its own scorer. Pure, no I/O, no new business logic — this
 * is presentation-layer relevance scoring over strings a provider already
 * fetched, exactly like the file it generalizes.
 */

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Classic Levenshtein edit distance (insert/delete/substitute), iterative
 * single-row DP — O(n*m) time, O(min(n,m)) space. Capped by callers at short
 * strings (title words), never run against a whole document body.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow.push(Math.min(currentRow[j - 1] + 1, previousRow[j] + 1, previousRow[j - 1] + cost));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length];
}

/**
 * True within `maxDistance` edits — the "typo tolerance" a plain substring
 * match can never offer (e.g. "Amroe" should still find "Amoré"). Distance
 * scales with term length (1 for ≤4 chars, 2 otherwise) so tolerance grows
 * with how much room a real typo has to hide in, rather than one fixed
 * threshold that's too loose on short terms and too strict on long ones.
 */
export function isFuzzyMatch(term: string, candidate: string, maxDistance?: number): boolean {
  const normalizedTerm = normalize(term);
  const normalizedCandidate = normalize(candidate);
  if (normalizedTerm === "" || normalizedCandidate === "") return false;

  const threshold = maxDistance ?? (normalizedTerm.length <= 4 ? 1 : 2);
  if (Math.abs(normalizedTerm.length - normalizedCandidate.length) > threshold) return false;

  return levenshteinDistance(normalizedTerm, normalizedCandidate) <= threshold;
}

export const MATCH_TIER_SCORES = {
  exact: 100,
  prefix: 90,
  wordPrefix: 80,
  substring: 70,
  fuzzy: 50,
} as const;

export type MatchTier = keyof typeof MATCH_TIER_SCORES | "none";

/**
 * The single scoring entry point every search candidate title/snippet
 * should go through — five tiers, checked strictest-first: exact match,
 * whole-string prefix, any individual word in `title` starting with `term`
 * (so "Amoré client" is found by typing "client"), substring anywhere, then
 * a fuzzy/typo-tolerant fallback against the title itself or any one word
 * in it. Returns `{tier: "none", score: 0}` rather than `null` so a caller
 * can always destructure without a null check, matching this codebase's
 * "never return a bare null where a discriminated shape reads clearer"
 * convention elsewhere (e.g. `RouteAccessRequirement`).
 */
export function scoreMatch(term: string, title: string): { tier: MatchTier; score: number } {
  const normalizedTerm = normalize(term);
  const normalizedTitle = normalize(title);
  if (normalizedTerm === "") return { tier: "none", score: 0 };

  if (normalizedTitle === normalizedTerm) return { tier: "exact", score: MATCH_TIER_SCORES.exact };
  if (normalizedTitle.startsWith(normalizedTerm)) return { tier: "prefix", score: MATCH_TIER_SCORES.prefix };

  const words = normalizedTitle.split(/\s+/).filter(Boolean);
  if (words.some((word) => word.startsWith(normalizedTerm))) return { tier: "wordPrefix", score: MATCH_TIER_SCORES.wordPrefix };
  if (normalizedTitle.includes(normalizedTerm)) return { tier: "substring", score: MATCH_TIER_SCORES.substring };

  if (isFuzzyMatch(normalizedTerm, normalizedTitle) || words.some((word) => isFuzzyMatch(normalizedTerm, word))) {
    return { tier: "fuzzy", score: MATCH_TIER_SCORES.fuzzy };
  }

  return { tier: "none", score: 0 };
}
