"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Vendor } from "@/types/vendor";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
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
    <div className="hidden md:block">
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>
              <span className="sr-only">Preferred</span>
            </TableHeaderCell>
            <TableHeaderCell>Company Name</TableHeaderCell>
            <TableHeaderCell>Display Name</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Email</TableHeaderCell>
            <TableHeaderCell>Phone</TableHeaderCell>
            <TableHeaderCell>Currency</TableHeaderCell>
            <TableHeaderCell>Tags</TableHeaderCell>
            <TableHeaderCell>Updated</TableHeaderCell>
            <TableHeaderCell>
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id}>
              <TableCell>
                <PreferredStar isPreferred={vendor.is_preferred} />
              </TableCell>
              <TableCell>
                <Link href={`/vendors/${vendor.id}`} className="text-[15px] font-medium text-text hover:text-accent">
                  {vendor.company_name}
                </Link>
              </TableCell>
              <TableCell className="text-text-muted">{vendor.display_name ?? "—"}</TableCell>
              <TableCell>
                <VendorStatusBadge status={vendor.status} />
              </TableCell>
              <TableCell className="text-text-muted">{vendor.email ?? "—"}</TableCell>
              <TableCell className="text-text-muted">{vendor.phone ?? "—"}</TableCell>
              <TableCell className="text-text-muted">{vendor.default_currency}</TableCell>
              <TableCell className="text-text-muted">
                {vendor.tags.length > 0 ? vendor.tags.join(", ") : "—"}
              </TableCell>
              <TableCell className="text-text-muted">
                {new Date(vendor.updated_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <ActionMenu actions={actionsFor(vendor)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
