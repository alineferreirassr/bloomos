import { Badge } from "@/components/ui/Badge";
import type { ServiceVersionStatus } from "@/core/enums/serviceVersionStatus";

interface VersionBadgeProps {
  status: ServiceVersionStatus;
  /** `null` for a draft that has never been published (no version number assigned yet). */
  versionNumber: number | null;
  /** Only meaningful when `status === "published"` — whether this is the Service's `current_published_version_id`, distinct from an earlier, now-superseded published version still visible in Version History. */
  isCurrent?: boolean;
}

/**
 * Text always carries the distinction on its own — "(previous)" is spelled
 * out, not communicated by tone alone, per the design system's "never rely
 * on color alone" rule.
 */
export function VersionBadge({ status, versionNumber, isCurrent = false }: VersionBadgeProps) {
  if (status === "draft") {
    return <Badge tone="neutral">Draft</Badge>;
  }
  if (status !== "published") {
    throw new Error(`VersionBadge received an unknown status: "${status}"`);
  }

  const label = versionNumber != null ? `Published v${versionNumber}` : "Published";
  return <Badge tone={isCurrent ? "accent" : "outline"}>{isCurrent ? label : `${label} (previous)`}</Badge>;
}
