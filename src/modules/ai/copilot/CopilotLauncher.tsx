"use client";

import { useCopilotPanel } from "@/modules/ai/copilot/CopilotProvider";
import { BloomAiIcon } from "@/components/ui/icons";

/**
 * Checkpoint 20, Step 1 — the Copilot's open triggers: a Floating Action
 * Button on mobile, plus the inline "Bloom AI" button in `TopBar.tsx`
 * (Classical routes only). Mounted once, route-independent (`(app)/layout.tsx`,
 * outside `AppShell`'s own Classical/Luxury branch) so it works identically
 * on every internal route, including `/dashboard` — a fixed-position
 * overlay never touches that route's own approved Luxury shell markup.
 *
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center. This
 * component used to also bind `mod+k` to open the Copilot panel — the exact
 * same shortcut string `CommandPalette.tsx` binds to open the Command
 * Center. Both listeners were live simultaneously (confirmed via this
 * checkpoint's own audit: neither coordinated with the other), so pressing
 * Cmd/Ctrl+K opened both overlays at once. The Universal Command Center is
 * the checkpoint's own explicit "CMD+K / CTRL+K" requirement, so it keeps
 * the shortcut; Copilot keeps its FAB and TopBar button, both unaffected.
 */
export function CopilotLauncher() {
  const { toggle } = useCopilotPanel();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open Bloom AI"
      className="bloom-elevation-modal fixed right-4 bottom-4 z-[var(--z-index-dropdown)] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform duration-150 hover:scale-105 md:hidden"
    >
      <BloomAiIcon className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
