/**
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center. A
 * genuinely minimal invocation counter — the only way "most searched
 * commands" (Search Analytics) can be real rather than fabricated, since
 * nothing tracked command usage before this checkpoint. In-memory, workspace-
 * agnostic (mirrors `core/commandPalette/registry.ts`'s own module-scope
 * `Map`, not a per-workspace persisted store) — reset alongside the command
 * registry in tests via `resetCommandUsage()`.
 */
const usage = new Map<string, number>();

export function recordCommandInvocation(commandId: string): void {
  usage.set(commandId, (usage.get(commandId) ?? 0) + 1);
}

export interface CommandUsageEntry {
  commandId: string;
  count: number;
}

export function getCommandUsage(): CommandUsageEntry[] {
  return [...usage.entries()].map(([commandId, count]) => ({ commandId, count })).sort((a, b) => b.count - a.count);
}

/** Test-only: restore to empty between test cases. */
export function resetCommandUsage(): void {
  usage.clear();
}
