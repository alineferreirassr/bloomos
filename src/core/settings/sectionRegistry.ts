import type { SettingsSectionDefinition } from "@/types/settings";

/**
 * The Step 3 Section Registry — organizational, deliberately separate from
 * the Setting Registry itself (`registry.ts`): a Section is a place in the
 * nav (icon, order, its own visibility gates), never a value. "Future
 * sections should self-register" is this Step's own literal wording — a
 * 15th Section needs exactly one `registerSettingsSection()` call.
 */
const sections = new Map<string, SettingsSectionDefinition>();

export function registerSettingsSection(definition: SettingsSectionDefinition): void {
  sections.set(definition.id, definition);
}

export function unregisterSettingsSection(id: string): void {
  sections.delete(id);
}

export function getSettingsSection(id: string): SettingsSectionDefinition | undefined {
  return sections.get(id);
}

/** Every registered Section, sorted by its own `order` (ties broken alphabetically by label) — the one stable ordering the Settings nav ever uses. */
export function listSettingsSections(): SettingsSectionDefinition[] {
  return [...sections.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/** Test-only: restore the registry to empty between test cases. */
export function resetSettingsSectionRegistry(): void {
  sections.clear();
}
