import type { HTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export type SortDirection = "asc" | "desc";

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

/** Wraps in its own horizontally-scrolling container, same pattern every hand-built `*ListTable.tsx` in this codebase already reaches for — a wide table must never force the page itself to scroll sideways. */
export function Table({ className = "", children, ...props }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-left text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <thead className={`border-b border-border text-xs tracking-wide text-text-muted uppercase ${className}`}>{children}</thead>;
}

export function TableBody({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <tbody className={className}>{children}</tbody>;
}

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
  selected?: boolean;
}

export function TableRow({ children, selected = false, className = "", ...props }: TableRowProps) {
  return (
    <tr aria-selected={selected || undefined} className={`border-b border-border/60 last:border-0 ${selected ? "bg-accent/8" : ""} ${className}`} {...props}>
      {children}
    </tr>
  );
}

interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
  sortDirection?: SortDirection | null;
  onSort?: () => void;
}

/**
 * Sortable only when `onSort` is passed — renders the label as a real
 * `<button>` inside the `<th>` (never the `<th>` itself made clickable), so
 * keyboard and screen-reader users get a proper interactive control.
 * `aria-sort` on the `<th>` reflects the CURRENT sort state per the
 * WAI-ARIA sortable-table pattern — the state a click would toggle TO is
 * never what `aria-sort` communicates.
 */
export function TableHeaderCell({ children, sortDirection, onSort, className = "", ...props }: TableHeaderCellProps) {
  const ariaSort = sortDirection === "asc" ? "ascending" : sortDirection === "desc" ? "descending" : onSort ? "none" : undefined;

  return (
    <th scope="col" aria-sort={ariaSort} className={`px-3 py-2 font-medium ${className}`} {...props}>
      {onSort ? (
        <button type="button" onClick={onSort} className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-text">
          {children}
          {sortDirection && (
            <span aria-hidden="true" className="text-[10px]">
              {sortDirection === "asc" ? "▲" : "▼"}
            </span>
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableCell({ children, className = "", ...props }: TableCellProps) {
  return (
    <td className={`px-3 py-2.5 align-middle text-text ${className}`} {...props}>
      {children}
    </td>
  );
}
