import { registerCommand } from "@/core/commandPalette/registry";

let registered = false;

function navigate(href: string): void {
  if (typeof window !== "undefined") window.location.href = href;
}

/**
 * Checkpoint 20, Step 18 — Command Palette Expansion. Registers into the
 * same `core/commandPalette/registry.ts` `BloomAISkillPicker` already
 * writes "Ask Bloom" into — the Copilot Panel's own search box (see
 * `CopilotPanel.tsx`) is the first surface that actually renders this
 * registry to a user, since the standalone `CommandPalette.tsx` shell was
 * never mounted anywhere in the app (confirmed: zero production imports).
 * Each command here either opens a real, existing destination or triggers
 * the Copilot Panel's own Brief — none invent a new page or duplicate a
 * Server Action; "Reserve Inventory"/"Assign Team" land on the same list
 * views a person would already use to do that by hand, since no single-
 * entity picker exists yet for either from a bare command (see Known
 * Limitations in the checkpoint docs).
 */
export function registerDefaultCopilotCommands(): void {
  if (registered) return;
  registered = true;

  registerCommand({ id: "copilot-create-proposal", label: "Create Proposal", group: "Create", keywords: ["proposal", "new"], run: () => navigate("/events") });
  registerCommand({ id: "copilot-open-client", label: "Open Client", group: "Navigate", keywords: ["client", "open"], run: () => navigate("/clients") });
  registerCommand({ id: "copilot-search-invoice", label: "Search Invoice", group: "Navigate", keywords: ["invoice", "search", "finance"], run: () => navigate("/finance/invoices") });
  registerCommand({ id: "copilot-generate-summary", label: "Generate Summary", group: "Bloom AI", keywords: ["brief", "summary", "report"], run: () => navigate("/bloom-ai") });
  registerCommand({ id: "copilot-create-reminder", label: "Create Reminder", group: "Create", keywords: ["reminder", "notification", "new"], run: () => navigate("/automation") });
  registerCommand({ id: "copilot-create-purchase", label: "Create Purchase", group: "Create", keywords: ["purchase", "order", "new"], run: () => navigate("/purchases/new") });
  registerCommand({ id: "copilot-reserve-inventory", label: "Reserve Inventory", group: "Inventory", keywords: ["inventory", "reserve", "stock"], run: () => navigate("/inventory") });
  registerCommand({ id: "copilot-assign-team", label: "Assign Team", group: "Events", keywords: ["team", "assign", "owner"], run: () => navigate("/events") });
  registerCommand({ id: "copilot-open-calendar", label: "Open Calendar", group: "Navigate", keywords: ["calendar", "schedule"], run: () => navigate("/events") });
}
