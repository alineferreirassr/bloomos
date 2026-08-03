/**
 * Lets a Skill's own on-page UI (`ProposalGeneratorPanel`,
 * `EventOperationsBriefSection`) register how to actually *trigger* itself
 * from wherever it's currently mounted — the Skill Picker (Step 10) reads
 * this to invoke a Skill without needing to know anything about how each
 * panel renders its own result. A Skill with no registered runner on the
 * current page (e.g. picked from the Bloom AI Dashboard, which has no Event
 * context to run against) simply isn't runnable from there; the picker
 * falls back to navigation in that case. Same Map-based, register/unregister/
 * reset shape as `core/commandPalette/registry.ts` on purpose.
 */
const runners = new Map<string, () => void | Promise<void>>();

export function registerSkillRunner(skillId: string, runner: () => void | Promise<void>): void {
  runners.set(skillId, runner);
}

export function unregisterSkillRunner(skillId: string): void {
  runners.delete(skillId);
}

export function getSkillRunner(skillId: string): (() => void | Promise<void>) | undefined {
  return runners.get(skillId);
}

/** Test-only: restore the registry to empty between test cases. */
export function resetSkillRunnerRegistry(): void {
  runners.clear();
}
