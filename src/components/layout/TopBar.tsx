"use client";

import { MenuIcon, BloomAiIcon, SearchIcon } from "@/components/ui/icons";
import { dispatchOpenCommandPalette } from "@/core/commandPalette/openCommandPaletteEvent";
import { useCopilotPanel } from "@/modules/ai/copilot/CopilotProvider";

interface TopBarProps {
  onMenuClick: () => void;
}

/**
 * GLOBAL-VISUAL-03B — rebuilt as the Classical-token twin of
 * `LuxuryTopbar` (Dashboard/Team's shell), not a bespoke redesign: same
 * search trigger (`dispatchOpenCommandPalette`, the same event
 * `CommandPalette.tsx` already listens for) and the same Bloom AI trigger
 * (`useCopilotPanel().toggle`, the same hook the floating FAB uses) — a
 * second entry point into each existing singleton, nothing new built. This
 * replaces the old muted page-title label entirely: the founder's target
 * grammar has the page's own `PageHeader` own the title (with an optional
 * breadcrumb), so a second, smaller copy of it here was always redundant,
 * not just on Relationships. No functionality removed — every route that
 * showed a title still shows one, once, in the page body.
 *
 * GLOBAL-VISUAL-03B.3 — geometry ported to AF Digital Studio OS's own real
 * header (app/(app)/_shell/header.tsx, HEAD 1587d1f): `h-16` (64px, was
 * 72px), `sticky top-0 z-20` + `bg-background/85 backdrop-blur-sm` (was
 * static, opaque), `px-5 sm:px-8` (matching the shared `<main>` gutter,
 * already ported in 03B.2), `gap-3`. Search trigger's own padding matches
 * AF's exact `px-3 py-1.5`; both icon-affordance buttons matched to AF's
 * `size-9` (36px, was 40px). Bloom AI keeps its bordered/tinted circle
 * (AF's own equivalent trigger is a bare icon button) — a deliberate brand
 * distinction, not an oversight: Bloom AI is BloomOS's own signature
 * feature, not a literal copy of AF's notification bell.
 */
export function TopBar({ onMenuClick }: TopBarProps) {
  const { toggle } = useCopilotPanel();

  return (
    <header className="sticky top-0 z-20 flex h-16 min-h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-5 backdrop-blur-sm md:justify-end md:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text md:hidden"
        aria-label="Open navigation menu"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
        <button
          type="button"
          onClick={dispatchOpenCommandPalette}
          aria-label="Search BloomOS"
          className="flex h-8 items-center gap-2 rounded-[10px] border border-border bg-surface-tint px-3 text-sm text-text-muted transition-colors duration-150 hover:text-text md:w-60"
        >
          <SearchIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden flex-1 text-left sm:inline">Search...</span>
          <span className="hidden rounded-[4px] border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-text-muted sm:inline">⌘K</span>
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label="Open Bloom AI"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-accent shadow-sm transition-colors duration-150 hover:bg-accent-100"
        >
          <BloomAiIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
