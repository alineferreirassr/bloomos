import { useQuery } from "@tanstack/react-query";
import { getServicesCatalog } from "@/lib/queries/services";
import type { ServicesCatalogFilters } from "@/lib/queries/services/types";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

/** Cheap to refetch and changes often under bulk actions — a short stale time keeps the list feeling live without refetching on every render. */
const CATALOG_STALE_TIME_MS = 30_000;

export function useServicesCatalog(filters: ServicesCatalogFilters = {}) {
  return useQuery({
    queryKey: serviceKeys.catalog(filters),
    queryFn: () => getServicesCatalog(filters),
    staleTime: CATALOG_STALE_TIME_MS,
    retry: shouldRetryQuery,
  });
}
