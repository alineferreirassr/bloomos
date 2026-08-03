import type { ServiceCapabilityType } from "@/core/enums/serviceCapabilityType";

/**
 * A named staffing skill/certification OR broad equipment/logistics
 * capability a Service typically requires (e.g. "Certified drone pilot" —
 * skill; "Requires a cargo van" — equipment). Feeds future Team Operations
 * matching/staffing.
 *
 * Originally modeled as two separate tables (ServiceSkillRequirement,
 * ServiceEquipmentRequirement) — collapsed into one discriminated table
 * during the pre-migration domain review once it was clear the two were
 * identical in every field except the label. Distinct from
 * ServiceInventoryTemplateItem: this is a lighter-weight planning flag, not
 * something pulled from stock.
 */
export interface ServiceCapabilityRequirement {
  id: string;
  workspace_id: string;
  service_version_id: string;
  capability_type: ServiceCapabilityType;
  label: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}
