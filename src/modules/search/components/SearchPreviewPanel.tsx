"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { SearchResult } from "@/core/search/types";
import type { WorkspaceFavorite } from "@/types/smartWorkspace";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * v2.0 Checkpoint 40 — instant preview for the currently-selected
 * `SearchResult`. Every field is optional on `SearchResult` itself (see
 * that type's own doc comment) — a field the provider never populated for
 * this entity type simply doesn't render here, never a fabricated
 * placeholder standing in for it.
 */
export function SearchPreviewPanel({
  result,
  favorite,
  onToggleFavorite,
  onTogglePinned,
  onCopyLink,
}: {
  result: SearchResult | null;
  favorite: WorkspaceFavorite | undefined;
  onToggleFavorite: (result: SearchResult) => void;
  onTogglePinned: (favoriteId: string) => void;
  onCopyLink: (result: SearchResult) => void;
}) {
  if (!result) {
    return (
      <Card className="flex h-full items-center justify-center p-6 text-center text-sm text-text-muted">
        Select a result to preview it here.
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-text-muted">{result.entityType.replace(/_/g, " ")}</p>
        <h3 className="mt-1 font-serif text-lg font-semibold text-text">{result.title}</h3>
        {result.snippet ? <p className="mt-1 text-sm text-text-muted">{result.snippet}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {result.status ? <Badge tone="accent">{result.status}</Badge> : null}
        {result.archived ? <Badge tone="neutral">Archived</Badge> : null}
        {result.health !== undefined ? <Badge tone={result.health >= 80 ? "success" : result.health >= 50 ? "warning" : "danger"}>{result.health}/100</Badge> : null}
        {favorite ? <Badge tone={favorite.pinned ? "accent" : "outline"}>{favorite.pinned ? "Pinned" : "Favorited"}</Badge> : null}
      </div>

      <dl className="flex flex-col gap-1.5 text-sm">
        {result.owner ? (
          <div className="flex justify-between gap-2">
            <dt className="text-text-muted">Owner</dt>
            <dd className="text-text">{result.owner}</dd>
          </div>
        ) : null}
        {result.lastUpdatedAt ? (
          <div className="flex justify-between gap-2">
            <dt className="text-text-muted">Last updated</dt>
            <dd className="text-text">{formatDateTime(result.lastUpdatedAt)}</dd>
          </div>
        ) : null}
        {result.tags && result.tags.length > 0 ? (
          <div className="flex justify-between gap-2">
            <dt className="text-text-muted">Tags</dt>
            <dd className="flex flex-wrap justify-end gap-1 text-text">
              {result.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
        <Link href={result.route}>
          <Button type="button" variant="primary">
            Open
          </Button>
        </Link>
        <Button type="button" variant="secondary" onClick={() => onToggleFavorite(result)}>
          {favorite ? "Unfavorite" : "Favorite"}
        </Button>
        {favorite ? (
          <Button type="button" variant="secondary" onClick={() => onTogglePinned(favorite.id)}>
            {favorite.pinned ? "Unpin" : "Pin"}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={() => onCopyLink(result)}>
          Copy Link
        </Button>
      </div>
    </Card>
  );
}
