"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import type { Vendor } from "@/types/vendor";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { archiveVendor, restoreVendor } from "@/lib/data";
import { VendorStatusBadge } from "@/modules/vendors/components/VendorStatusBadge";
import { PreferredStar } from "@/modules/vendors/components/PreferredStar";

interface VendorListCardsProps {
  vendors: Vendor[];
  onChanged: () => void;
}

export function VendorListCards({ vendors, onChanged }: VendorListCardsProps) {
  const router = useRouter();

  const actionsFor = (vendor: Vendor): ActionMenuAction[] => {
    const isArchived = vendor.archived_at !== null;
    const actions: ActionMenuAction[] = [
      { label: "View", onSelect: () => router.push(`/vendors/${vendor.id}`) },
    ];
    if (!isArchived) {
      actions.push({ label: "Edit", onSelect: () => router.push(`/vendors/${vendor.id}/edit`) });
      actions.push({
        label: "Archive",
        onSelect: async () => {
          await archiveVendor(vendor.id);
          onChanged();
        },
        destructive: true,
      });
    } else {
      actions.push({
        label: "Restore",
        onSelect: async () => {
          await restoreVendor(vendor.id);
          onChanged();
        },
      });
    }
    return actions;
  };

  return (
    <div className="space-y-3 md:hidden">
      {vendors.map((vendor) => (
        <LuxuryCard key={vendor.id}>
          <div className="flex items-start justify-between gap-3">
            <Link href={`/vendors/${vendor.id}`} className="block min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <PreferredStar isPreferred={vendor.is_preferred} />
                <p className="font-medium tracking-tight text-text">{vendor.company_name}</p>
              </div>
              {vendor.display_name ? <p className="mt-0.5 text-xs text-text-muted">{vendor.display_name}</p> : null}
              {vendor.email ? <p className="mt-0.5 text-xs text-text-muted">{vendor.email}</p> : null}
            </Link>
            <div className="flex shrink-0 items-start gap-2">
              <VendorStatusBadge status={vendor.status} />
              <ActionMenu actions={actionsFor(vendor)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            {vendor.phone ? <span>{vendor.phone}</span> : null}
            <span>{vendor.default_currency}</span>
            {vendor.tags.length > 0 ? <span>{vendor.tags.join(", ")}</span> : null}
          </div>
        </LuxuryCard>
      ))}
    </div>
  );
}
