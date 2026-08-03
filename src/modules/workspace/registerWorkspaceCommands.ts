import { registerCommand } from "@/core/commandPalette/registry";

let registered = false;

function navigate(href: string): void {
  if (typeof window !== "undefined") window.location.href = href;
}

/**
 * v2.0 Checkpoint 38, Step 11 — same idempotent-loader convention as
 * `registerDefaultCopilotCommands` (Checkpoint 20) and
 * `registerCommunicationCommands` (Checkpoint 24): a top-level `registered`
 * flag guards against re-registering on every render, called once from
 * `WorkspaceHomeView.tsx`'s module scope. Every entry navigates to a real,
 * already-built route — no new destination invented for the palette.
 */
export function registerDefaultWorkspaceCommands(): void {
  if (registered) return;
  registered = true;

  registerCommand({ id: "workspace-home", label: "Go to Workspace Home", group: "Navigate", keywords: ["workspace", "home", "dashboard"], run: () => navigate("/workspace") });
  registerCommand({ id: "workspace-knowledge-graph", label: "Open Knowledge Graph Explorer", group: "Navigate", keywords: ["knowledge", "graph", "explorer", "relationships"], run: () => navigate("/assets/knowledge-graph") });
  registerCommand({ id: "workspace-business-health", label: "Open Business Health", group: "Navigate", keywords: ["business", "health", "score"], run: () => navigate("/assets/business-health") });
  registerCommand({ id: "workspace-executive-decisions", label: "Open Executive Decisions", group: "Navigate", keywords: ["executive", "decisions", "priorities"], run: () => navigate("/assets/executive-decisions") });
  registerCommand({ id: "workspace-analytics", label: "Open Analytics", group: "Navigate", keywords: ["analytics", "revenue", "bi"], run: () => navigate("/analytics") });
  registerCommand({ id: "workspace-operations-center", label: "Open Operations Center", group: "Navigate", keywords: ["operations", "alerts", "incidents"], run: () => navigate("/operations-center") });
}
