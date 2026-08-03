import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { getVendorById } from "@/lib/data";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

/**
 * The `"vendor"` Merge Field domain (v2 Checkpoint 44) — resolved from
 * `context.vendorId`, for vendor-facing documents (a Vendor Guide, a
 * referral letter) this checkpoint's Template Library adds.
 */
export const vendorMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "vendor_name", label: "Vendor Name", description: "The linked Vendor's own company name.", domain: "vendor", valueType: "string", required: false },
  { key: "vendor_contact_email", label: "Vendor Contact Email", description: "The linked Vendor's own contact email.", domain: "vendor", valueType: "string", required: false },
  { key: "vendor_contact_phone", label: "Vendor Contact Phone", description: "The linked Vendor's own contact phone.", domain: "vendor", valueType: "string", required: false },
];

export function registerVendorMergeFields(): void {
  for (const definition of vendorMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("vendor_name", async (context) => {
    if (!context.vendorId) return null;
    const vendor = await getVendorById(context.vendorId).catch(() => null);
    return vendor?.display_name ?? vendor?.company_name ?? null;
  });

  registerMergeResolver("vendor_contact_email", async (context) => {
    if (!context.vendorId) return null;
    const vendor = await getVendorById(context.vendorId).catch(() => null);
    return vendor?.email ?? null;
  });

  registerMergeResolver("vendor_contact_phone", async (context) => {
    if (!context.vendorId) return null;
    const vendor = await getVendorById(context.vendorId).catch(() => null);
    return vendor?.phone ?? null;
  });
}
