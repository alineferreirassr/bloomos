"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/icons";
import { RecentSearchesView } from "@/modules/search/components/RecentSearchesView";
import { SavedSearchesView } from "@/modules/search/components/SavedSearchesView";
import type { SavedSearch } from "@/types/globalSearch";

/**
 * v2.0 Checkpoint 40 — the `/search` landing page: one big input plus this
 * member's own Recent + Saved Searches, mirroring the Universal Command
 * Center's own "search first, browse second" layout. Submitting always
 * navigates to `/search/results?q=…` — `SearchResultsView` owns every
 * result/filter/preview concern, this page never duplicates it.
 */
export function GlobalSearchView() {
  const router = useRouter();
  const [term, setTerm] = useState("");

  function go(searchTerm: string) {
    if (searchTerm.trim() === "") return;
    router.push(`/search/results?q=${encodeURIComponent(searchTerm)}`);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    go(term);
  }

  function handleSavedSearchSelect(search: SavedSearch) {
    go(search.term);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Global Search" subtitle="Search across every Client, Event, Proposal, Workflow, Decision, and more — one index, your own permissions." icon={SearchIcon} />

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search anything…"
          aria-label="Search anything"
          className="w-full rounded-md border border-border bg-surface px-4 py-3 text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <Button type="submit" variant="primary">
          Search
        </Button>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RecentSearchesView onSelect={go} />
        <SavedSearchesView onSelect={handleSavedSearchSelect} />
      </div>
    </div>
  );
}
