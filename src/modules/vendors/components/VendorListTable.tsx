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
    <div className="hidden overflow-x-auto rounded-md border border-border md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">
              <span className="sr-only">Preferred</span>
            </th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Company Name</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Display Name</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Status</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Email</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Phone</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Currency</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Tags</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Updated</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => (
            <tr key={vendor.id} className="hover:bg-text/4">
              <td className="border-b border-border px-2.5 py-2">
                <PreferredStar isPreferred={vendor.is_preferred} />
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <Link href={`/vendors/${vendor.id}`} className="font-medium text-text hover:text-accent">
                  {vendor.company_name}
                </Link>
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{vendor.display_name ?? "—"}</td>
              <td className="border-b border-border px-2.5 py-2">
                <VendorStatusBadge status={vendor.status} />
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{vendor.email ?? "—"}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{vendor.phone ?? "—"}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{vendor.default_currency}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">
                {vendor.tags.length > 0 ? vendor.tags.join(", ") : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">
                {new Date(vendor.updated_at).toLocaleDateString()}
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <ActionMenu actions={actionsFor(vendor)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
