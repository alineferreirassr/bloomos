"use client";

import type { ReactNode } from "react";
import { SearchIcon, MenuIcon } from "@/components/ui/icons";
import { BloomAiIcon } from "@/components/ui/icons";
import { dispatchOpenCommandPalette } from "@/core/commandPalette/openCommandPaletteEvent";
import { useCopilotPanel } from "@/modules/ai/copilot/CopilotProvider";

/**
 * App Shell redesign — the shared, sparse topbar the reference product's
 * own screenshots show (a search pill + a couple of icon buttons, nothing
 * else): shell-owned so both Founder and Team get it identically, instead
 * of each dashboard view separately wiring its own action row. Reuses the
 * two existing global singletons rather than building new ones — the
 * search pill dispatches the same open-event `CommandPalette.tsx` now also
 * listens for, and the Bloom AI button calls the same `useCopilotPanel()`
 * hook `CopilotLauncher`'s own floating FAB already uses — so this is a
 * second entry point into each, not a duplicate implementation, and
 * neither existing trigger is removed.
 *
 * `actions` is the per-dashboard slot (date selector, notification/message
 * counts) — those stay data-owned by whichever dashboard aggregator
 * fetched the counts, same pattern `sidebarFooter` already established for
 * `ProfileMenu`; the shell just gives them a persistent home instead of
 * each view rebuilding this row inside its own `PersonalizedWelcomeHeader`.
 *
 * `onOpenMobileNav`, when provided, renders the mobile drawer's hamburger
 * trigger as the leading element of this same row instead of the shell
 * stacking a second `md:hidden` row above it — two rows each carrying their
 * own top padding produced a visibly doubled gap on mobile.
 */
export function LuxuryTopbar({ actions, onOpenMobileNav }: { actions?: ReactNode; onOpenMobileNav?: () => void }) {
  const { toggle } = useCopilotPanel();

  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-6 sm:pt-6 md:justify-end md:px-8 md:pt-8">
      {onOpenMobileNav ? (
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-luxury-surface text-luxury-text shadow-luxury-sm md:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      ) : null}
      <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
        <button
          type="button"
          onClick={dispatchOpenCommandPalette}
          aria-label="Search BloomOS"
          className="flex h-10 items-center gap-2 rounded-luxury-full border border-luxury-border bg-luxury-surface px-4 text-luxury-small font-medium text-luxury-text-muted shadow-luxury-sm transition-colors duration-150 hover:text-luxury-text"
        >
          <SearchIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Search...</span>
          <span className="hidden rounded-luxury-sm border border-luxury-border px-1.5 py-0.5 text-[10px] font-semibold text-luxury-text-muted sm:inline">⌘K</span>
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label="Open Bloom AI"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-luxury-full border border-luxury-border bg-luxury-surface text-luxury-rose shadow-luxury-sm transition-colors duration-150 hover:bg-luxury-blush"
        >
          <BloomAiIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
