"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { archiveVendor, restoreVendor } from "@/lib/data";
import type { Vendor } from "@/types/vendor";

interface VendorActionsProps {
  vendor: Vendor;
  onChanged: () => void;
}

export function VendorActions({ vendor, onChanged }: VendorActionsProps) {
  const [pendingAction, setPendingAction] = useState<"archive" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isArchived = vendor.archived_at !== null;

  const handleArchive = async () => {
    setPendingAction("archive");
    setError(null);
    const result = await archiveVendor(vendor.id);
    setPendingAction(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  const handleRestore = async () => {
    setPendingAction("restore");
    setError(null);
    const result = await restoreVendor(vendor.id);
    setPendingAction(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!isArchived ? (
          <Link href={`/vendors/${vendor.id}/edit`}>
            <Button type="button" variant="secondary">
              Edit
            </Button>
          </Link>
        ) : null}

        {isArchived ? (
          <Button type="button" variant="secondary" onClick={handleRestore} disabled={pendingAction === "restore"}>
            {pendingAction === "restore" ? "Restoring…" : "Restore"}
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={handleArchive} disabled={pendingAction === "archive"}>
            {pendingAction === "archive" ? "Archiving…" : "Archive"}
          </Button>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
