"use client";

import { memo } from "react";
import { HealthCategoryCard } from "@/modules/services/components/HealthCategoryCard";
import type { HealthCategoryStatus } from "@/modules/services/serviceHealthNavigation";
import type { ServiceHealthMissingItem } from "@/lib/queries/services/types";

interface HealthCategoryListProps {
  statuses: HealthCategoryStatus[];
  onNavigate: (jumpTo: ServiceHealthMissingItem["jumpTo"]) => void;
}

function HealthCategoryListImpl({ statuses, onNavigate }: HealthCategoryListProps) {
  return (
    <div className="space-y-3">
      <h3 className="font-serif text-[17px] font-semibold text-text">Category breakdown</h3>
      {statuses.map((status) => (
        <HealthCategoryCard key={status.key} status={status} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

/** `statuses` is a fresh array every render (derived in HealthDashboardPage), but each entry's identity is stable per key — memoizing the list itself still avoids re-rendering every card when only the navigate callback identity changes upstream. */
export const HealthCategoryList = memo(HealthCategoryListImpl);
