"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDialogBehavior } from "@/components/ui/useDialogBehavior";
import { BloomGlassPanel } from "@/components/ui/BloomGlassPanel";
import { useKeyboardShortcut } from "@/core/commandPalette/useKeyboardShortcut";
import { COMMAND_PALETTE_OPEN_EVENT } from "@/core/commandPalette/openCommandPaletteEvent";
import { getCommands } from "@/core/commandPalette/registry";
import { filterCommands } from "@/core/commandPalette/filter";
import { recordCommandInvocation } from "@/core/commandPalette/commandUsageStore";
import { searchAction } from "@/modules/search/searchActions";
import type { CommandAction } from "@/core/commandPalette/types";
import type { SearchResult } from "@/core/search/types";

interface CommandPaletteProps {
  /**
   * Scopes Universal Search results to one Workspace. Omitted entirely,
   * the palette still works as a pure command launcher — it just skips the
   * search call, so this component has no hard dependency on session
   * context yet. A later checkpoint wires this from the real app shell.
   */
  workspaceId?: string;
}

/**
 * The one, singleton Command Palette instance — mount it once near the app
 * root. It opens itself on "mod+k" and owns its own open/closed state, so
 * no parent needs to manage it. No business `CommandAction`s are registered
 * by default this checkpoint (see `core/commandPalette/registry.ts`) — the
 * empty state below is the expected, correct v2-Checkpoint-1 behavior, not
 * a bug.
 *
 * v2.0 Checkpoint 40 — this IS the Universal Command Center's Cmd/Ctrl+K
 * overlay (the checkpoint's own "replace every isolated command palette
 * with this single Universal Command Center" — there was only ever this one
 * palette, so the fix here is making its search half as real as its
 * command half): the search box now calls `searchAction()`
 * (`modules/search/searchActions.ts`) instead of raw `runSearch()`, so
 * results here are permission-filtered, ranked, favorite/recent-boosted,
 * and recorded to this member's own Search History — never a second,
 * unfiltered search path.
 */
export function CommandPalette({ workspaceId }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Resetting query/results lives here (an event handler), not in an effect
  // watching `open` — a synchronous setState directly in an effect body is
  // the exact cascading-render pattern this project's lint config forbids
  // (see the DocumentsSummarySection precedent this mirrors).
  function close() {
    setOpen(false);
    setQuery("");
    setSearchResults([]);
    setActiveIndex(0);
  }

  useKeyboardShortcut("mod+k", () => (open ? close() : setOpen(true)));
  useDialogBehavior({ open, onClose: close, containerRef: dialogRef, lockScroll: true });

  // App Shell redesign — the Luxury Topbar's search pill opens this same
  // singleton palette via a `window` custom event instead of duplicating
  // search logic into a second component. Purely additive: "mod+k" keeps
  // working exactly as before.
  useEffect(() => {
    function handleOpenRequest() {
      setOpen(true);
    }
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpenRequest);
    return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpenRequest);
  }, []);

  useEffect(() => {
    if (!open || !workspaceId) return;

    let cancelled = false;
    const term = query.trim();
    const search = term === "" ? Promise.resolve<SearchResult[]>([]) : searchAction(term).then((result) => (result.success ? result.data.slice(0, 8) : []));
    search.then((results) => {
      if (!cancelled) {
        setSearchResults(results);
        setActiveIndex(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, query]);

  if (!open) return null;

  const commands = filterCommands(getCommands(), query);
  const isEmpty = commands.length === 0 && searchResults.length === 0;
  const flatCount = commands.length + searchResults.length;

  function runActive() {
    if (activeIndex < commands.length) {
      const command = commands[activeIndex];
      close();
      recordCommandInvocation(command.id);
      void command.run();
    } else {
      const result = searchResults[activeIndex - commands.length];
      if (result) window.location.href = result.route;
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (flatCount === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flatCount);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + flatCount) % flatCount);
    } else if (event.key === "Enter") {
      event.preventDefault();
      runActive();
    }
  }

  return (
    <div className="fixed inset-0 z-[var(--z-index-modal)] flex items-start justify-center p-4 pt-[10vh]">
      <button type="button" aria-label="Close command palette" onClick={close} className="absolute inset-0 bg-neutral-800/50" />
      <BloomGlassPanel
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
        className="animate-modal-in relative flex w-full max-w-[560px] flex-col overflow-hidden shadow-md focus:outline-none"
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or run a command…"
          aria-label="Search or run a command"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-text placeholder:text-text-muted focus:outline-none"
        />
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {isEmpty ? (
            <p className="px-2.5 py-6 text-center text-sm text-text-muted">
              {query.trim() === "" ? "No commands yet." : "No results."}
            </p>
          ) : (
            <>
              {commands.length > 0 ? <CommandGroup commands={commands} activeIndex={activeIndex} onRun={close} /> : null}
              {searchResults.length > 0 ? <SearchResultGroup results={searchResults} activeIndex={activeIndex - commands.length} onNavigate={close} /> : null}
            </>
          )}
        </div>
        {query.trim() !== "" ? (
          <Link
            href={`/search/results?q=${encodeURIComponent(query)}`}
            onClick={close}
            className="border-t border-border px-4 py-2.5 text-center text-xs text-accent hover:underline"
          >
            View all results in Global Search
          </Link>
        ) : null}
      </BloomGlassPanel>
    </div>
  );
}

function CommandGroup({ commands, activeIndex, onRun }: { commands: CommandAction[]; activeIndex: number; onRun: () => void }) {
  return (
    <ul>
      {commands.map((command, index) => (
        <li key={command.id}>
          <button
            type="button"
            onClick={() => {
              onRun();
              recordCommandInvocation(command.id);
              void command.run();
            }}
            className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-text hover:bg-text/7 ${index === activeIndex ? "bg-text/7" : ""}`}
          >
            <span>{command.label}</span>
            <span className="text-xs text-text-muted">{command.group}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SearchResultGroup({ results, activeIndex, onNavigate }: { results: SearchResult[]; activeIndex: number; onNavigate: () => void }) {
  return (
    <ul>
      {results.map((result, index) => (
        <li key={`${result.entityType}-${result.entityId}`}>
          <a
            href={result.route}
            onClick={onNavigate}
            className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-text hover:bg-text/7 ${index === activeIndex ? "bg-text/7" : ""}`}
          >
            <span>{result.title}</span>
            <span className="text-xs text-text-muted">{result.entityType}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
