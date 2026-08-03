import type { CommandAction } from "@/core/commandPalette/types";

/**
 * What the Command Palette can run, decoupled from the palette UI itself —
 * a module registers its actions here once (nothing does yet; this
 * checkpoint is infrastructure only), and the palette component just
 * enumerates the registry instead of hardcoding every action it can invoke.
 * Same registry shape as `core/search/registry.ts` on purpose.
 */
const registry = new Map<string, CommandAction>();

export function registerCommand(action: CommandAction): void {
  registry.set(action.id, action);
}

export function unregisterCommand(id: string): void {
  registry.delete(id);
}

export function getCommands(): CommandAction[] {
  return [...registry.values()];
}

export function getCommandById(id: string): CommandAction | undefined {
  return registry.get(id);
}

/** Test-only: restore the registry to empty between test cases. */
export function resetCommandRegistry(): void {
  registry.clear();
}
