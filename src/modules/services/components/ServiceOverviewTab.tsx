import { ServiceIdentityForm } from "@/modules/services/components/ServiceIdentityForm";
import { DraftVersionForm } from "@/modules/services/components/DraftVersionForm";
import { ServiceVersionSummary } from "@/modules/services/components/ServiceVersionSummary";
import { ServiceOverviewHealthCard } from "@/modules/services/components/ServiceOverviewHealthCard";
import { ServiceUsageCount } from "@/modules/services/components/ServiceUsageCount";
import { ServiceRecentActivity } from "@/modules/services/components/ServiceRecentActivity";
import { Card } from "@/components/ui/Card";
import type { ServiceEditorData } from "@/lib/queries/services/types";
import type { ServiceCategory } from "@/types/serviceCategory";
import type { ServiceInput, ServiceVersionInput } from "@/modules/services/schema";
import type { Service } from "@/types/service";
import type { ServiceVersion } from "@/types/serviceVersion";
import type { ServiceDetailTabValue } from "@/modules/services/components/ServiceDetailTabs";

interface ServiceOverviewTabProps {
  editor: ServiceEditorData;
  categories: ServiceCategory[];
  onSaveIdentity: (input: ServiceInput) => Promise<Service>;
  onSaveDraftVersion: (input: ServiceVersionInput) => Promise<ServiceVersion>;
  identityReadOnly: boolean;
  draftReadOnly: boolean;
  readOnlyReason?: string;
  onNavigateToTab: (tab: ServiceDetailTabValue) => void;
}

/**
 * Every section the spec asks Overview to show — identity, draft fields,
 * published-version summary, health, usage, recent activity — composed with
 * progressive disclosure (each its own Card) rather than one giant form.
 * Two columns on wide screens (editable content left, at-a-glance summaries
 * right); a single stacked column below the `lg` breakpoint, matching the
 * responsiveness the spec calls out explicitly.
 */
export function ServiceOverviewTab({
  editor,
  categories,
  onSaveIdentity,
  onSaveDraftVersion,
  identityReadOnly,
  draftReadOnly,
  readOnlyReason,
  onNavigateToTab,
}: ServiceOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div id="service-identity-card">
          <ServiceIdentityForm
            service={editor.service}
            categories={categories}
            onSave={onSaveIdentity}
            readOnly={identityReadOnly}
            readOnlyReason={readOnlyReason}
          />
        </div>
        <div id="draft-version-form">
          <DraftVersionForm draftVersion={editor.draftVersion} onSave={onSaveDraftVersion} readOnly={draftReadOnly} readOnlyReason={readOnlyReason} />
        </div>
        <ServiceVersionSummary publishedVersion={editor.publishedVersion} />
        <ServiceRecentActivity activities={editor.recentTimeline} />
      </div>
      <div className="space-y-4">
        <ServiceOverviewHealthCard health={editor.health} onNavigateToTab={onNavigateToTab} />
        <Card>
          <h3 className="font-serif text-[17px] font-semibold text-text">Usage</h3>
          <div className="mt-2">
            <ServiceUsageCount count={editor.usageCount} />
          </div>
        </Card>
      </div>
    </div>
  );
}
