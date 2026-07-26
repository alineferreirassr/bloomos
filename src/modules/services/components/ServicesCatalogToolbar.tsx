import { Button } from "@/components/ui/Button";
import { ViewToggle, type CatalogViewMode } from "@/modules/services/components/ViewToggle";
import { SortSelector, type ServicesCatalogSortBy } from "@/modules/services/components/SortSelector";

interface ServicesCatalogToolbarProps {
  resultCount: number;
  viewMode: CatalogViewMode;
  onViewModeChange: (mode: CatalogViewMode) => void;
  sortBy: ServicesCatalogSortBy;
  onSortByChange: (sortBy: ServicesCatalogSortBy) => void;
  bulkModeActive: boolean;
  onToggleBulkMode: () => void;
  className?: string;
}

export function ServicesCatalogToolbar({
  resultCount,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortByChange,
  bulkModeActive,
  onToggleBulkMode,
  className = "",
}: ServicesCatalogToolbarProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <p className="text-sm text-text-muted" aria-live="polite">
        {resultCount} {resultCount === 1 ? "Service" : "Services"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <SortSelector value={sortBy} onChange={onSortByChange} />
        <ViewToggle value={viewMode} onChange={onViewModeChange} />
        <Button type="button" variant={bulkModeActive ? "primary" : "secondary"} aria-pressed={bulkModeActive} onClick={onToggleBulkMode}>
          Select
        </Button>
      </div>
    </div>
  );
}
