"use client";

import { ServiceHealthSummaryCard } from "@/modules/services/components/ServiceHealthSummaryCard";
import type { ServiceHealthMissingItem, ServiceHealthSummary } from "@/lib/queries/services/types";
import type { ServiceDetailTabValue } from "@/modules/services/components/ServiceDetailTabs";

interface ServiceOverviewHealthCardProps {
  health: ServiceHealthSummary;
  onNavigateToTab: (tab: ServiceDetailTabValue) => void;
}

/**
 * Wires `ServiceHealthSummaryCard`'s generic `onMissingItemSelect` callback
 * (built in Checkpoint 2B with no navigation opinion of its own) to this
 * screen's actual tabs. A `templateCategory` item switches to the Templates
 * tab — which only shows this checkpoint's honest placeholder, since the
 * Template Builder itself isn't built yet — rather than doing nothing;
 * `draftVersionForm` scrolls to the Draft Version section already on this
 * same Overview tab.
 */
export function ServiceOverviewHealthCard({ health, onNavigateToTab }: ServiceOverviewHealthCardProps) {
  function handleMissingItemSelect(item: ServiceHealthMissingItem) {
    if (item.jumpTo.kind === "templateCategory") {
      onNavigateToTab("templates");
      return;
    }
    document.getElementById("draft-version-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <ServiceHealthSummaryCard health={health} onMissingItemSelect={handleMissingItemSelect} />;
}
