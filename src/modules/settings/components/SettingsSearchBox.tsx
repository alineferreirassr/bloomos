"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { searchSettingsAction } from "@/modules/settings/searchSettingsAction";
import type { SettingsSearchResult } from "@/core/settings/search";

interface SettingsSearchBoxProps {
  onNavigate: (sectionId: string) => void;
}

const DEBOUNCE_MS = 150;

/**
 * Step 14's own Global Settings Search — "typing should immediately
 * navigate to the correct section." Debounced so every keystroke doesn't
 * round-trip to the Server Action; selecting a result (click or Enter on
 * the top match) calls `onNavigate`, which the parent `SettingsView` uses
 * to switch the active section — this component owns no navigation state
 * of its own.
 */
export function SettingsSearchBox({ onNavigate }: SettingsSearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SettingsSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!trimmedQuery) return;
    timeoutRef.current = setTimeout(() => {
      searchSettingsAction(trimmedQuery).then((next) => {
        setResults(next);
        setOpen(true);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [trimmedQuery]);

  const showDropdown = open && trimmedQuery.length > 0;

  function select(result: SettingsSearchResult) {
    onNavigate(result.sectionId);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <Input
        id="settings-global-search"
        type="search"
        placeholder="Search settings — timezone, invoice, approval…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) select(results[0]);
          if (event.key === "Escape") setOpen(false);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        aria-label="Search settings"
      />
      {showDropdown && results.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-md">
          {results.map((result) => (
            <li key={`${result.kind}-${result.id}`}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(result)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-text/7"
              >
                <span className="font-medium text-text">{result.label}</span>
                <span className="text-xs text-text/55">{result.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {showDropdown && results.length === 0 ? (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text/55 shadow-md">No matching settings.</div>
      ) : null}
    </div>
  );
}
