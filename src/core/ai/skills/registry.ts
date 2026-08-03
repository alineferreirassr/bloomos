import type { SkillCategory, SkillDefinition } from "@/core/ai/skills/types";

/**
 * One Map keyed by Skill `id`, matching every other registry in this
 * codebase (`core/ai/providerRegistry.ts`, `core/ai/prompts/registry.ts`,
 * `core/search/registry.ts`). Registering an `id` already in use replaces
 * that entry — each Skill's own `registerXSkill()` call site is what
 * actually guarantees "registration happens exactly once" (the same
 * module-level `let registered = false` guard `registerProposalUseCase()`
 * already uses), not this Map rejecting a second call.
 */
const skills = new Map<string, SkillDefinition>();

export function registerSkill(definition: SkillDefinition): void {
  skills.set(definition.id, definition);
}

export function unregisterSkill(id: string): void {
  skills.delete(id);
}

export function getSkill(id: string): SkillDefinition | undefined {
  return skills.get(id);
}

/** Every registered Skill, in registration order — callers that need a stable display order should sort explicitly (see `listSkillsForWorkspace`), since Map iteration order is an implementation detail, not a declared contract. */
export function listSkills(): SkillDefinition[] {
  return [...skills.values()];
}

export function listSkillsByCategory(category: SkillCategory): SkillDefinition[] {
  return listSkills().filter((skill) => skill.category === category);
}

/** Test-only: restore the registry to empty between test cases. */
export function resetSkillRegistry(): void {
  skills.clear();
}
