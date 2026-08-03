import type { ActivityEntry } from "@/types/communication";

/**
 * v2.0 Checkpoint 32 — Journey Timeline Adapter (Step 12). "Do not create
 * another Timeline store": this is a pure merge over `ActivityEntry[]`
 * arrays the module layer already fetched from the existing Unified
 * Communication Timeline (`getEntityTimelineData`) — once per owner
 * (the Lead/Client itself, and every linked Proposal/Contract/Invoice/
 * Event) — since a per-entity Timeline query only returns entries owned
 * by that one entity. Merging several of those real queries client-side
 * is the "coordinate, don't duplicate" seam; nothing here writes a
 * Timeline row of its own beyond what the module layer's own real
 * mutation actions already record (see `timelineActivityType.ts`'s own
 * Checkpoint 32 disclosure comment for which of the spec's 28 named
 * events are proxied from an existing event vs. genuinely new).
 */

export function mergeJourneyTimeline(entryGroups: ActivityEntry[][]): ActivityEntry[] {
  const seen = new Set<string>();
  const merged: ActivityEntry[] = [];
  for (const group of entryGroups) {
    for (const entry of group) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      merged.push(entry);
    }
  }
  return merged.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
