export interface SortParams<TField extends string> {
  field: TField;
  direction: "asc" | "desc";
}

/** Reads `?sort=field` (optionally `-field` for descending, the same convention JSON:API/most REST APIs already use) from the request URL — `null` when absent or the field isn't in `allowedFields`, so a route handler falls back to its own default order rather than guessing at an unknown field. */
export function parseSort<TField extends string>(url: URL, allowedFields: readonly TField[]): SortParams<TField> | null {
  const raw = url.searchParams.get("sort");
  if (!raw) return null;
  const direction: "asc" | "desc" = raw.startsWith("-") ? "desc" : "asc";
  const field = (raw.startsWith("-") ? raw.slice(1) : raw) as TField;
  if (!allowedFields.includes(field)) return null;
  return { field, direction };
}

/** Generic stable sort over any array, given a value-selector for the sorted field — string and number fields both compare correctly via a shared `<`/`>` comparison. */
export function applySort<T, TField extends string>(items: T[], sort: SortParams<TField> | null, selector: (item: T, field: TField) => string | number): T[] {
  if (!sort) return items;
  const sorted = [...items].sort((a, b) => {
    const valueA = selector(a, sort.field);
    const valueB = selector(b, sort.field);
    if (valueA < valueB) return -1;
    if (valueA > valueB) return 1;
    return 0;
  });
  return sort.direction === "desc" ? sorted.reverse() : sorted;
}
