"use client";

import dynamic from "next/dynamic";

/**
 * Checkpoint 45A — Finding 23b. CopilotPanel/CopilotLauncher/CommandPalette
 * (which pulls in the search pipeline via `searchAction`) were mounted
 * directly from the `(app)` root layout, an async Server Component, so
 * `next/dynamic(..., { ssr: false })` can't be called there directly —
 * `ssr: false` is only valid inside a Client Component. This wrapper is
 * that Client Component: it code-splits all three into their own chunk,
 * loaded only after hydration, on every route, instead of eagerly on
 * first paint — the same per-route splitting the Workflow Canvas's
 * `@xyflow/react` already gets automatically.
 */
const CopilotPanel = dynamic(() => import("@/modules/ai/copilot/CopilotPanel").then((m) => m.CopilotPanel), { ssr: false });
const CopilotLauncher = dynamic(() => import("@/modules/ai/copilot/CopilotLauncher").then((m) => m.CopilotLauncher), { ssr: false });
const CommandPalette = dynamic(() => import("@/components/ui/CommandPalette").then((m) => m.CommandPalette), { ssr: false });

export function DeferredFloatingWidgets({ workspaceId }: { workspaceId: string }) {
  return (
    <>
      <CopilotPanel />
      <CopilotLauncher />
      <CommandPalette workspaceId={workspaceId} />
    </>
  );
}
