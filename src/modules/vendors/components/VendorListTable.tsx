"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Vendor } from "@/types/vendor";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { archiveVendor, restoreVendor } from "@/lib/data";
import { VendorStatusBadge } from "@/modules/vendors/components/VendorStatusBadge";
import { PreferredStar } from "@/modules/vendors/components/PreferredStar";

interface VendorListTableProps {
  vendors: Vendor[];
  onChanged: () => void;
}

export function VendorListTable({ vendors, onChanged }: VendorListTableProps) {
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
    <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr className="border-b border-border/70">
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">
              <span className="sr-only">Preferred</span>
            </th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Company Name</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Display Name</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Status</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Email</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Phone</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Currency</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Tags</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Updated</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {vendors.map((vendor) => (
            <tr key={vendor.id} className="transition-colors duration-150 hover:bg-accent-100/25">
              <td className="px-5 py-4">
                <PreferredStar isPreferred={vendor.is_preferred} />
              </td>
              <td className="px-5 py-4">
                <Link href={`/vendors/${vendor.id}`} className="text-[15px] font-medium text-text hover:text-accent">
                  {vendor.company_name}
                </Link>
              </td>
              <td className="px-5 py-4 text-text-muted">{vendor.display_name ?? "—"}</td>
              <td className="px-5 py-4">
                <VendorStatusBadge status={vendor.status} />
              </td>
              <td className="px-5 py-4 text-text-muted">{vendor.email ?? "—"}</td>
              <td className="px-5 py-4 text-text-muted">{vendor.phone ?? "—"}</td>
              <td className="px-5 py-4 text-text-muted">{vendor.default_currency}</td>
              <td className="px-5 py-4 text-text-muted">
                {vendor.tags.length > 0 ? vendor.tags.join(", ") : "—"}
              </td>
              <td className="px-5 py-4 text-text-muted">
                {new Date(vendor.updated_at).toLocaleDateString()}
              </td>
              <td className="px-5 py-4">
                <ActionMenu actions={actionsFor(vendor)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
