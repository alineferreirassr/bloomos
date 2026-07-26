"use client";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTemplateBuilder } from "@/modules/services/hooks/useTemplateBuilder";
import { computeTemplateCompletion } from "@/lib/queries/services/templateCompletion";
import { ALL_TEMPLATE_CATEGORY_ADAPTERS } from "@/modules/services/templateCategoryAdapters";

interface VersionChangeListProps {
  serviceVersionId: string;
}

function categoryLabel(key: string): string {
  return ALL_TEMPLATE_CATEGORY_ADAPTERS.find((adapter) => adapter.key === key)?.label ?? key;
}

/**
 * "Template completion" is genuinely re-derivable for ANY version, not just
 * the current draft — unlike Service Health (which `health.ts` only ever
 * computes for `service.draft_version_id`), every template table is scoped
 * to `service_version_id`, so a published version's own rows are still
 * exactly what they were at publish time. Fetching `useTemplateBuilder` for
 * only the selected version (not every row up front) is the "lazy-render
 * detail panels" the spec asks for — switching versions in the timeline is
 * the only thing that ever triggers a new fetch here.
 */
export function VersionChangeList({ serviceVersionId }: VersionChangeListProps) {
  const query = useTemplateBuilder(serviceVersionId);

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Included in this version</h3>

      {query.status === "pending" ? (
        <div className="mt-3 space-y-2" aria-busy="true" aria-live="polite">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : null}

      {query.status === "error" ? <p role="alert" className="mt-2 text-sm text-danger">We couldn&apos;t load this version&apos;s template snapshot.</p> : null}

      {query.status === "success" ? <VersionChangeListContent data={query.data} /> : null}
    </Card>
  );
}

function VersionChangeListContent({ data }: { data: NonNullable<ReturnType<typeof useTemplateBuilder>["data"]> }) {
  const completion = computeTemplateCompletion(data);
  const categoriesWithItems = data.groups.flatMap((group) => group.categories).filter((category) => category.count > 0);

  return (
    <>
      <div className="mt-3">
        <ProgressBar value={completion.percent} label="Template completion" />
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {completion.requiredComplete} of {completion.requiredTotal} required categories complete · {completion.optionalUsed} of {completion.optionalTotal} optional categories used.
      </p>
      {categoriesWithItems.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {categoriesWithItems.map((category) => (
            <li key={category.key} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-text">
              {categoryLabel(category.key)} ({category.count})
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-text-muted">This version has no template items.</p>
      )}
      <p className="mt-3 text-xs text-text-muted">This is a snapshot of what this version includes, not a diff from the previous version.</p>
    </>
  );
}
