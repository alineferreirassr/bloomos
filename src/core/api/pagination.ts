import type { PaginationMeta } from "@/types/api";

const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

export interface PaginationParams {
  page: number;
  perPage: number;
}

/** Reads `?page=`/`?per_page=` from the request URL, clamped to sane bounds — never a negative page, never a `per_page` large enough for one request to walk an entire table. Invalid/missing values fall back to page 1 / the default page size rather than erroring, matching every other optional-query-param convention already in this codebase. */
export function parsePagination(url: URL): PaginationParams {
  const rawPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const rawPerPage = Number.parseInt(url.searchParams.get("per_page") ?? String(DEFAULT_PER_PAGE), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const perPage = Number.isFinite(rawPerPage) && rawPerPage > 0 ? Math.min(rawPerPage, MAX_PER_PAGE) : DEFAULT_PER_PAGE;
  return { page, perPage };
}

/** Slices `items` for one page and builds the matching `PaginationMeta` — generic over any already-filtered/sorted array, so every list endpoint calls this exactly the same way. */
export function paginate<T>(items: T[], params: PaginationParams): { items: T[]; meta: PaginationMeta } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / params.perPage));
  const start = (params.page - 1) * params.perPage;
  return {
    items: items.slice(start, start + params.perPage),
    meta: { page: params.page, perPage: params.perPage, total, totalPages },
  };
}
