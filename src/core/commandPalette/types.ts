/**
 * One entry a user can find and invoke from the Command Palette. `group`
 * clusters actions in the results list (e.g. "Navigation", "Leads",
 * "Create") the same way `SearchableEntityConfig.module` clusters search
 * results — deliberately the same shape so a future combined results view
 * can render both lists with one component. `keywords` lets an action be
 * found by a synonym its `label` doesn't contain (e.g. label "New Lead",
 * keyword "create"). No action is registered by default this phase — see
 * `core/commandPalette/registry.ts`.
 */
export interface CommandAction {
  id: string;
  label: string;
  group: string;
  keywords?: string[];
  /** e.g. "mod+k" — "mod" means Cmd on macOS, Ctrl elsewhere. Optional: most actions are found by typing, not memorized. */
  shortcut?: string;
  run: () => void | Promise<void>;
}
