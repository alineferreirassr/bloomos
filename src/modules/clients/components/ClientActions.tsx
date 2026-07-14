"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { archiveClient, restoreClient } from "@/lib/data";
import type { Client } from "@/types/client";
import { ClientStatusSelect } from "@/modules/clients/components/ClientStatusSelect";
import { VipToggle } from "@/modules/clients/components/VipToggle";
import { ContactMethodSelect } from "@/modules/clients/components/ContactMethodSelect";

interface ClientActionsProps {
  client: Client;
  onChanged: () => void;
}

export function ClientActions({ client, onChanged }: ClientActionsProps) {
  const [pendingAction, setPendingAction] = useState<"archive" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isArchived = client.internal_status === "archived";

  const handleArchive = async () => {
    setPendingAction("archive");
    setError(null);
    const result = await archiveClient(client.id);
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
    const result = await restoreClient(client.id);
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
          <Link href={`/clients/${client.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        ) : null}

        {!isArchived ? <VipToggle clientId={client.id} isVip={client.is_vip} onChanged={onChanged} /> : null}

        {isArchived ? (
          <Button variant="secondary" onClick={handleRestore} disabled={pendingAction === "restore"}>
            {pendingAction === "restore" ? "Restoring…" : "Restore"}
          </Button>
        ) : (
          <Button variant="secondary" onClick={handleArchive} disabled={pendingAction === "archive"}>
            {pendingAction === "archive" ? "Archiving…" : "Archive"}
          </Button>
        )}
      </div>

      {!isArchived ? (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-muted">Status</span>
            <ClientStatusSelect clientId={client.id} status={client.internal_status} onChanged={onChanged} />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-muted">Preferred contact method</span>
            <ContactMethodSelect
              clientId={client.id}
              method={client.preferred_contact_method}
              onChanged={onChanged}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
