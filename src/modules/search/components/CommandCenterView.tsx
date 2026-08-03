"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { CommandCenterIcon } from "@/components/ui/icons";
import { getCommands } from "@/core/commandPalette/registry";
import { filterCommands } from "@/core/commandPalette/filter";
import { recordCommandInvocation } from "@/core/commandPalette/commandUsageStore";
import { getWorkspaceSummaryAction } from "@/modules/workspace/workspaceActions";
import type { CommandAction } from "@/core/commandPalette/types";
import type { WorkspaceFavorite, WorkspaceRecentItem, WorkspaceRecommendation } from "@/types/smartWorkspace";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; favorites: WorkspaceFavorite[]; recentItems: WorkspaceRecentItem[]; recommendations: WorkspaceRecommendation[] };

function NavList({ title, items }: { title: string; items: { key: string; label: string; href: string; meta?: string }[] }) {
  return (
    <Card>
      <h3 className="font-serif text-base font-semibold text-text">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">Nothing here yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-sm">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="flex items-center justify-between gap-2 py-1.5 text-text hover:text-accent">
                <span className="truncate">{item.label}</span>
                {item.meta ? <span className="shrink-0 text-xs text-text-muted">{item.meta}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * v2.0 Checkpoint 40 — `/command-center`: a full-page, keyboard-first
 * browse/search surface for every registered `CommandAction`
 * (`core/commandPalette/registry.ts`, the same registry Cmd/Ctrl+K's
 * overlay reads), plus "Universal Navigation" composed entirely from
 * Checkpoint 38's own Smart Workspace summary — Favorites, Recent Pages,
 * Most Visited, Recently Edited, and Suggested (the Executive Decision
 * queue) — never a second navigation index.
 */
export function CommandCenterView() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    getWorkspaceSummaryAction().then((result) => {
      if (result.success) setState({ status: "ready", favorites: result.data.favorites, recentItems: result.data.recentItems, recommendations: result.data.recommendations });
      else setState({ status: "error", message: result.error });
    });
  }, []);

  const commands = useMemo(() => filterCommands(getCommands(), query), [query]);
  const grouped = useMemo(() => {
    const groups = new Map<string, CommandAction[]>();
    for (const command of commands) {
      const list = groups.get(command.group) ?? [];
      list.push(command);
      groups.set(command.group, list);
    }
    return [...groups.entries()];
  }, [commands]);

  function runCommand(command: CommandAction) {
    recordCommandInvocation(command.id);
    void command.run();
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Command Center" subtitle="Every command and every page you can reach, in one browsable, searchable place. Press Cmd/Ctrl+K for the quick overlay anywhere." icon={CommandCenterIcon} />

      <input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter commands…"
        aria-label="Filter commands"
        className="w-full rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
      />

      {grouped.length === 0 ? (
        <p className="text-sm text-text-muted">No commands match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.map(([group, groupCommands]) => (
            <Card key={group}>
              <h3 className="font-serif text-base font-semibold text-text">{group}</h3>
              <ul className="mt-2 divide-y divide-border text-sm">
                {groupCommands.map((command) => (
                  <li key={command.id}>
                    <button type="button" onClick={() => runCommand(command)} className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-text hover:text-accent">
                      <span className="truncate">{command.label}</span>
                      {command.shortcut ? <Badge tone="neutral">{command.shortcut}</Badge> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-2 font-serif text-lg font-semibold text-text">Universal Navigation</h2>

      {state.status === "loading" ? (
        <TableSkeleton rows={4} columns={2} />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NavList
            title="Pinned"
            items={state.favorites
              .filter((f) => f.pinned)
              .map((f) => ({ key: f.id, label: f.label, href: f.href }))}
          />
          <NavList
            title="Favorites"
            items={state.favorites
              .filter((f) => !f.pinned)
              .map((f) => ({ key: f.id, label: f.label, href: f.href }))}
          />
          <NavList
            title="Recent Pages"
            items={[...state.recentItems]
              .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime())
              .slice(0, 8)
              .map((r) => ({ key: r.id, label: r.label, href: r.href, meta: new Date(r.viewed_at).toLocaleDateString() }))}
          />
          <NavList
            title="Most Visited"
            items={[...state.recentItems]
              .sort((a, b) => b.visit_count - a.visit_count)
              .slice(0, 8)
              .map((r) => ({ key: r.id, label: r.label, href: r.href, meta: `${r.visit_count}×` }))}
          />
          <NavList
            title="Recently Edited"
            items={state.recentItems
              .filter((r) => r.action === "edit")
              .slice(0, 8)
              .map((r) => ({ key: r.id, label: r.label, href: r.href }))}
          />
          <NavList
            title="Suggested / Continue Working"
            items={state.recommendations.slice(0, 8).map((decision) => ({ key: decision.id, label: decision.title, href: "/assets/executive-decisions" }))}
          />
        </div>
      )}

      <p className="text-xs text-text-muted">
        Prefer the overlay? Press <kbd className="rounded border border-border px-1">Cmd/Ctrl</kbd>+<kbd className="rounded border border-border px-1">K</kbd> from anywhere, or visit{" "}
        <button type="button" onClick={() => router.push("/search")} className="underline">
          Global Search
        </button>
        .
      </p>
    </div>
  );
}
