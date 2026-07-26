import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ServicePrice } from "@/modules/services/components/ServicePrice";
import { SERVICE_EXPERIENCE_LEVEL_LABELS } from "@/core/enums/serviceExperienceLevel";
import type { ServiceVersion } from "@/types/serviceVersion";
import type { ChecklistItem } from "@/types/checklistItem";

interface ServiceVersionSectionProps {
  version: ServiceVersion;
  /** The generated checklist for this EventService — reused as-is from the Execution tab's own fetch, never re-queried here, so "Template completion snapshot" reflects real generated work rather than a fabricated number. */
  checklistItems: ChecklistItem[];
}

/**
 * Read-only. No "Draft indicator" ever actually renders in practice — an
 * EventService can only ever be assigned from a "published" ServiceVersion
 * (see serviceVersionStatus.ts's own doc comment), so `version.status` is
 * always "published" here. The badge is still driven by the real field
 * rather than hardcoded, in case that invariant is ever violated by a data
 * problem — the UI would surface it honestly instead of lying.
 */
export function ServiceVersionSection({ version, checklistItems }: ServiceVersionSectionProps) {
  const completed = checklistItems.filter((item) => item.status === "completed").length;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-[17px] font-semibold text-text">Service version</h3>
        <Badge tone={version.status === "published" ? "accent" : "outline"}>{version.status === "published" ? "Published" : "Draft"}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-text-muted">Version</dt>
          <dd className="text-text">{version.version_number !== null ? `Version ${version.version_number}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Base price</dt>
          <dd className="text-text">
            <ServicePrice amountMinor={version.base_price_minor} currency={version.currency} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Experience required</dt>
          <dd className="text-text">{version.experience_level_required ? SERVICE_EXPERIENCE_LEVEL_LABELS[version.experience_level_required] : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Setup / breakdown</dt>
          <dd className="text-text">
            {version.setup_duration_minutes ?? "—"} min / {version.breakdown_duration_minutes ?? "—"} min
          </dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-border pt-3 text-sm">
        <span className="text-text-muted">Template completion snapshot: </span>
        <span className="text-text">
          {checklistItems.length === 0 ? "No generated checklist items" : `${completed} of ${checklistItems.length} items completed`}
        </span>
      </div>
    </Card>
  );
}
