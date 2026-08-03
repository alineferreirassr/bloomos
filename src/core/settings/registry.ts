import type { SettingDefinition, SettingsCategory } from "@/types/settings";

/**
 * The Step 2 Settings Registry — the same `Map<id, definition>` shape
 * every registry in this codebase already uses (`core/ai/skills/registry.ts`,
 * `core/automation/actionRegistry.ts`, `core/workflow/nodeRegistry.ts`).
 * "Every module registers its own settings. No hardcoded Settings page" is
 * this Step's own literal wording — the Settings UI reads this catalog
 * exclusively, never a hand-maintained switch statement keyed on a
 * setting's own id.
 */
const settings = new Map<string, SettingDefinition>();

export function registerSetting(definition: SettingDefinition): void {
  settings.set(definition.id, definition);
}

export function unregisterSetting(id: string): void {
  settings.delete(id);
}

export function getSetting(id: string): SettingDefinition | undefined {
  return settings.get(id);
}

/** Every registered Setting, in registration order — callers needing a stable display order should sort explicitly, since Map iteration order is an implementation detail. */
export function listSettings(): SettingDefinition[] {
  return [...settings.values()];
}

export function listSettingsForSection(sectionId: string): SettingDefinition[] {
  return listSettings().filter((setting) => setting.sectionId === sectionId);
}

export function listSettingsByCategory(sectionId: string, category: SettingsCategory): SettingDefinition[] {
  return listSettingsForSection(sectionId).filter((setting) => setting.category === category);
}

/** Test-only: restore the registry to empty between test cases. */
export function resetSettingsRegistry(): void {
  settings.clear();
}
