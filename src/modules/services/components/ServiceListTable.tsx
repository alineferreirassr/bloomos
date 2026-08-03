import { Table, TableBody, TableHead, TableHeaderCell, TableRow, type SortDirection } from "@/components/ui/Table";
import { Checkbox } from "@/components/ui/Checkbox";
import { ServiceListRow } from "@/modules/services/components/ServiceListRow";
import type { ServicesCatalogSortBy } from "@/modules/services/components/SortSelector";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";
import type { ServiceCatalogRow } from "@/lib/queries/services/types";

/**
 * Each sort dimension's own fixed direction (matching `getServicesCatalog`'s
 * `SORT_COMPARATORS` exactly) — there's no independent asc/desc toggle in
 * the domain, so clicking a sortable header sets `sortBy` to that column
 * rather than cycling a direction that doesn't exist.
 */
const SORT_DIRECTIONS: Record<ServicesCatalogSortBy, SortDirection> = {
  name: "asc",
  health: "desc",
  usage: "desc",
  updatedAt: "desc",
};

interface ServiceListTableProps {
  rows: ServiceCatalogRow[];
  selectable?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (serviceId: string) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  sortBy: ServicesCatalogSortBy;
  onSortByChange: (sortBy: ServicesCatalogSortBy) => void;
  actionsFor: (row: ServiceCatalogRow) => ActionMenuAction[];
  className?: string;
}

export function ServiceListTable({
  rows,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  someSelected,
  sortBy,
  onSortByChange,
  actionsFor,
  className = "",
}: ServiceListTableProps) {
  return (
    <Table className={className}>
      <TableHead>
        <TableRow>
          {selectable ? (
            <TableHeaderCell>
              <Checkbox
                aria-label="Select all Services"
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onChange={onToggleSelectAll}
              />
            </TableHeaderCell>
          ) : null}
          <TableHeaderCell onSort={() => onSortByChange("name")} sortDirection={sortBy === "name" ? SORT_DIRECTIONS.name : null}>
            Name
          </TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell onSort={() => onSortByChange("health")} sortDirection={sortBy === "health" ? SORT_DIRECTIONS.health : null}>
            Health
          </TableHeaderCell>
          <TableHeaderCell>Price</TableHeaderCell>
          <TableHeaderCell onSort={() => onSortByChange("usage")} sortDirection={sortBy === "usage" ? SORT_DIRECTIONS.usage : null}>
            Usage
          </TableHeaderCell>
          <TableHeaderCell>Version</TableHeaderCell>
          <TableHeaderCell onSort={() => onSortByChange("updatedAt")} sortDirection={sortBy === "updatedAt" ? SORT_DIRECTIONS.updatedAt : null}>
            Updated
          </TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <ServiceListRow
            key={row.service.id}
            row={row}
            selectable={selectable}
            selected={selectedIds.has(row.service.id)}
            onToggleSelect={onToggleSelect}
            actions={actionsFor(row)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
