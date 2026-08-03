"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchWorkspaceAction } from "@/modules/workspace/workspaceActions";
import type { SearchResult } from "@/core/search/types";

/**
 * v2.0 Checkpoint 38, Step 3 — Global Search widget. Calls `searchWorkspaceAction`,
 * which calls `runSearch()` (`core/search/pipeline.ts`) — the same, single
 * search pipeline the Command Palette and Bloom AI Copilot already call.
 * No parallel search index.
 */
export function GlobalSearchWidget() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const query = term.trim();

    if (!query) {
      // Routed through a microtask (not a synchronous setState in the
      // effect body) to match the `react-hooks/set-state-in-effect` rule
      // this codebase enforces — same async-only pattern `CommandPalette.tsx`
      // already uses for its own search box.
      Promise.resolve().then(() => {
        if (!cancelled) {
          setResults([]);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const timeout = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      searchWorkspaceAction(query).then((result) => {
        if (cancelled) return;
        setResults(result.success ? result.data : []);
        setLoading(false);
      });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [term]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search leads, clients, events, contracts, invoices, documents, assets, team, vendors…"
        aria-label="Search everything"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
      {loading ? <p className="text-xs text-text-muted">Searching…</p> : null}
      {!loading && term.trim() && results.length === 0 ? <p className="text-xs text-text-muted">No matches for &ldquo;{term}&rdquo;.</p> : null}
      {results.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {results.slice(0, 8).map((result) => (
            <li key={`${result.entityType}-${result.entityId}`}>
              <Link href={result.route} className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-accent/5">
                <span className="text-sm font-medium text-text">{result.title}</span>
                <span className="text-xs text-text-muted">
                  {result.entityType}
                  {result.snippet ? ` · ${result.snippet}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
