"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { SearchIcon } from "@/components/ui/icons";
import { SearchPreviewPanel } from "@/modules/search/components/SearchPreviewPanel";
import { searchAction, listSearchableEntityTypesAction, createSavedSearchAction, type SearchableEntitySummary } from "@/modules/search/searchActions";
import { getWorkspaceSummaryAction, toggleFavoriteAction, togglePinnedFavoriteAction } from "@/modules/workspace/workspaceActions";
import type { SearchResult } from "@/core/search/types";
import type { EntityType } from "@/core/enums/entityType";
import type { WorkspaceFavorite } from "@/types/smartWorkspace";

interface SearchResultsViewProps {
  initialQuery: string;
}

/**
 * v2.0 Checkpoint 40 — the full results page behind `/search/results`.
 * Every call goes through `searchAction()` (permission-filtered, ranked,
 * boosted, history-recorded) — never `runSearch()` directly, keeping this
 * the one place a client component touches Global Search.
 */
export function SearchResultsView({ initialQuery }: SearchResultsViewProps) {
  const router = useRouter();
  const [term, setTerm] = useState(initialQuery);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [searchableEntities, setSearchableEntities] = useState<SearchableEntitySummary[]>([]);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [favorites, setFavorites] = useState<WorkspaceFavorite[]>([]);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; message: string } | null>(null);

  useEffect(() => {
    listSearchableEntityTypesAction().then((result) => {
      if (result.success) setSearchableEntities(result.data);
    });
    getWorkspaceSummaryAction().then((result) => {
      if (result.success) setFavorites(result.data.favorites);
    });
  }, []);

  /** Only the async half — synchronous `setLoading(true)`/`setError(null)` live at each call site instead, so the initial-mount `useEffect` below never calls a function that sets state synchronously in its own body (the exact pattern this project's lint config forbids). */
  const runSearch = useCallback((searchTerm: string, types: EntityType[]) => {
    searchAction(searchTerm, types.length > 0 ? types : undefined).then((result) => {
      setLoading(false);
      if (result.success) {
        setResults(result.data);
        setSelected(result.data[0] ?? null);
      } else {
        setError(result.error);
      }
    });
  }, []);

  useEffect(() => {
    runSearch(initialQuery, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the initial load reacts to the page's own `q` param; subsequent searches are user-triggered via handleSubmit/toggleEntityType, which set loading/error themselves before calling runSearch.
  }, [initialQuery]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    router.push(`/search/results?q=${encodeURIComponent(term)}`);
    setLoading(true);
    setError(null);
    runSearch(term, entityTypes);
  }

  function toggleEntityType(entityType: EntityType) {
    const next = entityTypes.includes(entityType) ? entityTypes.filter((t) => t !== entityType) : [...entityTypes, entityType];
    setEntityTypes(next);
    setLoading(true);
    setError(null);
    runSearch(term, next);
  }

  async function handleToggleFavorite(result: SearchResult) {
    const response = await toggleFavoriteAction(result.entityType, result.entityId, result.title, result.route);
    if (response.success) setFavorites(response.data);
    else setToast({ tone: "danger", message: response.error });
  }

  async function handleTogglePinned(favoriteId: string) {
    const response = await togglePinnedFavoriteAction(favoriteId);
    if (response.success) setFavorites(response.data);
    else setToast({ tone: "danger", message: response.error });
  }

  async function handleCopyLink(result: SearchResult) {
    const url = `${window.location.origin}${result.route}`;
    await navigator.clipboard.writeText(url);
    setToast({ tone: "success", message: "Link copied." });
  }

  async function handleSaveSearch() {
    const label = window.prompt("Name this saved search:", term);
    if (!label) return;
    const response = await createSavedSearchAction(label, term, entityTypes.length > 0 ? { entityTypes } : null);
    setToast(response.success ? { tone: "success", message: `Saved search "${label}" created.` } : { tone: "danger", message: response.error });
  }

  const favoriteByKey = useMemo(() => {
    const map = new Map<string, WorkspaceFavorite>();
    for (const favorite of favorites) map.set(`${favorite.entity_type}:${favorite.entity_id}`, favorite);
    return map;
  }, [favorites]);

  const labelByType = useMemo(() => new Map(searchableEntities.map((entry) => [entry.entityType, entry.label])), [searchableEntities]);

  const grouped = useMemo(() => {
    if (!results) return [];
    const groups = new Map<EntityType, SearchResult[]>();
    for (const result of results) {
      const list = groups.get(result.entityType) ?? [];
      list.push(result);
      groups.set(result.entityType, list);
    }
    return [...groups.entries()];
  }, [results]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Search Results" subtitle="Every result respects your permissions — hidden entities never appear here." icon={SearchIcon} breadcrumb={[{ label: "Search", href: "/search" }, { label: "Results" }]} />

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search clients, events, invoices, workflows…"
          aria-label="Search term"
          className="w-full rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <Button type="submit" variant="primary">
          Search
        </Button>
        <Button type="button" variant="secondary" onClick={handleSaveSearch} disabled={term.trim() === ""}>
          Save Search
        </Button>
      </form>

      {searchableEntities.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by entity type">
          {searchableEntities.map((entry) => (
            <button
              key={entry.entityType}
              type="button"
              onClick={() => toggleEntityType(entry.entityType)}
              aria-pressed={entityTypes.includes(entry.entityType)}
              className="focus:outline-none focus:ring-2 focus:ring-accent/40 rounded-full"
            >
              <Badge tone={entityTypes.includes(entry.entityType) ? "accent" : "outline"}>{entry.label}</Badge>
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <TableSkeleton rows={5} columns={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => runSearch(term, entityTypes)} />
      ) : !results || results.length === 0 ? (
        <EmptyState title="No results" description={term.trim() === "" ? "Type a search term above to get started." : `No results for "${term}".`} icon={SearchIcon} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            {grouped.map(([entityType, groupResults]) => (
              <Card key={entityType} className="overflow-hidden p-0">
                <h3 className="border-b border-border px-4 py-3 font-serif text-base font-semibold text-text">
                  {labelByType.get(entityType) ?? entityType} <span className="text-sm font-normal text-text-muted">({groupResults.length})</span>
                </h3>
                <ul className="divide-y divide-border">
                  {groupResults.map((result) => {
                    const favorite = favoriteByKey.get(`${result.entityType}:${result.entityId}`);
                    return (
                      <li key={`${result.entityType}-${result.entityId}`}>
                        <button
                          type="button"
                          onClick={() => setSelected(result)}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-text/5 ${selected === result ? "bg-text/7" : ""}`}
                        >
                          <span className="flex flex-col">
                            <span className="text-text">{result.title}</span>
                            {result.snippet ? <span className="text-xs text-text-muted">{result.snippet}</span> : null}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {favorite ? <Badge tone={favorite.pinned ? "accent" : "outline"}>{favorite.pinned ? "Pinned" : "Favorite"}</Badge> : null}
                            {result.status ? <Badge tone="neutral">{result.status}</Badge> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
          <div className="lg:sticky lg:top-4 lg:self-start">
            <SearchPreviewPanel
              result={selected}
              favorite={selected ? favoriteByKey.get(`${selected.entityType}:${selected.entityId}`) : undefined}
              onToggleFavorite={handleToggleFavorite}
              onTogglePinned={handleTogglePinned}
              onCopyLink={handleCopyLink}
            />
          </div>
        </div>
      )}

      <p className="text-xs text-text-muted">
        Looking for saved searches or history? Head back to <Link href="/search" className="underline">Global Search</Link>.
      </p>

      {toast ? <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
