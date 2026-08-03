import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import type { WorkspaceFavorite } from "@/types/smartWorkspace";

interface FavoritesWidgetProps {
  favorites: WorkspaceFavorite[];
  onRemove: (favoriteId: string) => void;
}

export function FavoritesWidget({ favorites, onRemove }: FavoritesWidgetProps) {
  if (favorites.length === 0) {
    return <EmptyState title="No favorites yet" description="Pin any lead, client, event, contract, invoice, or asset for quick access here." />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {favorites.slice(0, 8).map((favorite) => (
        <li key={favorite.id} className="flex items-center justify-between gap-2">
          <Link href={favorite.href} className="truncate text-sm font-medium text-text hover:text-accent">
            {favorite.label}
          </Link>
          <Button type="button" variant="ghost" className="!px-1.5 text-xs" aria-label={`Remove ${favorite.label} from favorites`} onClick={() => onRemove(favorite.id)}>
            ✕
          </Button>
        </li>
      ))}
    </ul>
  );
}
