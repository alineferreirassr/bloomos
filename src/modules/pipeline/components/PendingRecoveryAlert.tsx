"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { Client } from "@/types/client";

export interface PendingRecoveryNotice {
  leadId: string;
  client: Client;
}

interface PendingRecoveryAlertProps {
  notice: PendingRecoveryNotice;
  onDismiss: () => void;
}

/**
 * Persistent banner for a booking that converted the Lead to a Client but
 * failed to create/advance the Event — never represented as a completed
 * booking. The Client already carries a durable pending_recovery record
 * (see markClientRecoveryPending); this banner is just the visible surface
 * for it on this board, not the source of truth.
 */
export function PendingRecoveryAlert({ notice, onDismiss }: PendingRecoveryAlertProps) {
  return (
    <div role="alert" className="flex items-start justify-between gap-4 rounded-md border border-accent bg-accent/8 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-text">
          Booking incomplete for {notice.client.first_name} {notice.client.last_name}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          The Lead was converted to a Client, but creating or advancing the Event failed.{" "}
          {notice.client.pending_recovery?.reason ?? ""} This is recoverable — resume booking from the Client
          record.
        </p>
        <Link href={`/clients/${notice.client.id}`} className="mt-2 inline-block text-xs font-semibold text-accent underline">
          Open Client record
        </Link>
      </div>
      <Button variant="ghost" onClick={onDismiss} aria-label="Dismiss">
        Dismiss
      </Button>
    </div>
  );
}
