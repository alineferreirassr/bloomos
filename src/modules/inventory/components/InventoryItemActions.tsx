"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { archiveInventoryItem, restoreInventoryItem } from "@/lib/data";
import type { InventoryItem } from "@/types/inventoryItem";

interface InventoryItemActionsProps {
  item: InventoryItem;
  onChanged: () => void;
}

/**
 * Unlike VendorActions (which archives immediately, no confirmation —
 * archiving a Vendor has no cascading effect), archiving an Inventory item
 * blocks all future stock movements until restored, so this uses the
 * confirm-modal pattern already established by
 * VendorDocumentsSection/InventoryDocumentsSection's own archive flow
 * instead of firing immediately.
 */
export function InventoryItemActions({ item, onChanged }: InventoryItemActionsProps) {
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [pendingAction, setPendingAction] = useState<"archive" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isArchived = item.archived_at !== null;

  const handleArchive = async () => {
    setPendingAction("archive");
    setError(null);
    const result = await archiveInventoryItem(item.id);
    setPendingAction(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setConfirmingArchive(false);
    onChanged();
  };

  const handleRestore = async () => {
    setPendingAction("restore");
    setError(null);
    const result = await restoreInventoryItem(item.id);
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
          <Link href={`/inventory/${item.id}/edit`}>
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
          <Button type="button" variant="secondary" onClick={() => setConfirmingArchive(true)}>
            Archive
          </Button>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Modal open={confirmingArchive} onClose={() => setConfirmingArchive(false)} title="Archive this item?">
        <p>
          {`"${item.name}" will be archived. It stays readable, but it can't be edited or receive new stock movements until you restore it.`}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={handleArchive} disabled={pendingAction === "archive"}>
            {pendingAction === "archive" ? "Archiving…" : "Archive"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setConfirmingArchive(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
