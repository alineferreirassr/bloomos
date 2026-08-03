import type { Vendor } from "@/types/vendor";
import type { VendorFormValues } from "@/modules/vendors/components/VendorForm";

/** Converts a Vendor record's null fields into the plain-string/boolean shape the form works with. */
export function vendorToFormInput(vendor: Vendor): VendorFormValues {
  return {
    company_name: vendor.company_name,
    display_name: vendor.display_name ?? "",
    email: vendor.email ?? "",
    phone: vendor.phone ?? "",
    website: vendor.website ?? "",
    tax_id: vendor.tax_id ?? "",
    default_currency: vendor.default_currency,
    is_preferred: vendor.is_preferred,
    status: vendor.status,
    tags: vendor.tags,
    notes: vendor.notes ?? "",
  };
}
