import { useQuery } from "@tanstack/react-query";
import { listServiceCategories } from "@/lib/data";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

/** Active categories only — this exists to populate the Identity form's category `<Select>`, never a full management list, so an archived category never becomes newly selectable. */
export function useServiceCategories() {
  return useQuery({
    queryKey: serviceKeys.categories(),
    queryFn: () => listServiceCategories(),
    staleTime: 0,
    retry: shouldRetryQuery,
  });
}
