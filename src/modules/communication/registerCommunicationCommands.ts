import { registerCommand } from "@/core/commandPalette/registry";

let registered = false;

function navigate(href: string): void {
  if (typeof window !== "undefined") window.location.href = href;
}

/**
 * v2.0 Checkpoint 24, Step 13 — Command Center Integration. Same registry,
 * same idempotent-loader convention as `registerDefaultCopilotCommands`
 * (Checkpoint 20) — the Copilot Panel's own search box is the one surface
 * that actually renders this registry today (the standalone
 * `CommandPalette.tsx` shell is still unmounted, per that file's own doc
 * comment), so this loader is called from `CopilotPanel.tsx` alongside it.
 */
export function registerDefaultCommunicationCommands(): void {
  if (registered) return;
  registered = true;

  registerCommand({ id: "comms-open-notifications", label: "Open Notification Center", group: "Communication", keywords: ["notification", "bell", "alert"], run: () => navigate("/communications") });
  registerCommand({ id: "comms-open-inbox", label: "Open Inbox", group: "Communication", keywords: ["inbox", "message", "conversation"], run: () => navigate("/inbox") });
  registerCommand({ id: "comms-open-activity-feed", label: "Open Activity Feed", group: "Communication", keywords: ["activity", "feed", "timeline"], run: () => navigate("/communications") });
  registerCommand({ id: "comms-create-reminder", label: "Create Reminder", group: "Communication", keywords: ["reminder", "task", "follow up"], run: () => navigate("/communications") });
  registerCommand({ id: "comms-open-announcements", label: "Open Announcements", group: "Communication", keywords: ["announcement", "broadcast"], run: () => navigate("/communications") });
}
