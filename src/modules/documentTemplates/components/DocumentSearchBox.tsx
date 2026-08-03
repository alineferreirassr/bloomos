"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { searchDocumentsAction } from "@/modules/documentTemplates/searchDocumentsAction";
import type { DocumentSearchResult } from "@/core/documents/search";

const DEBOUNCE_MS = 150;

/** Step 15's own Global Document Search — searches Title, Client, Template, Variables, Content, and Metadata across both Templates and Documents at once, navigating straight to whichever the member picks. */
export function DocumentSearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!trimmedQuery) return;
    timeoutRef.current = setTimeout(() => {
      searchDocumentsAction(trimmedQuery).then((next) => {
        setResults(next);
        setOpen(true);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [trimmedQuery]);

  const showDropdown = open && trimmedQuery.length > 0;

  function select(result: DocumentSearchResult) {
    router.push(result.kind === "template" ? `/document-templates/${result.id}` : `/document-templates/documents/${result.id}`);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <Input
        id="documents-global-search"
        type="search"
        placeholder="Search templates, documents, clients…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) select(results[0]);
          if (event.key === "Escape") setOpen(false);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        aria-label="Search documents"
      />
      {showDropdown && results.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-md">
          {results.map((result) => (
            <li key={`${result.kind}-${result.id}`}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(result)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-text/7"
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span className="font-medium text-text">{result.title}</span>
                  <span className="text-xs text-text/55">{result.description}</span>
                </span>
                <Badge tone="outline">{result.kind === "template" ? "Template" : "Document"}</Badge>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {showDropdown && results.length === 0 ? (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text/55 shadow-md">No matching Templates or Documents.</div>
      ) : null}
    </div>
  );
}
