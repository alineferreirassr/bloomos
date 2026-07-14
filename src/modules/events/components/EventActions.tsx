"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { archiveEvent, cancelEvent, completeEvent, restoreEvent } from "@/lib/data";
import type { Event } from "@/types/event";
import { isEventTerminal } from "@/core/workflows/eventWorkflow";
import { EventStatusSelect } from "@/modules/events/components/EventStatusSelect";
import { EventLifecycleSelect } from "@/modules/events/components/EventLifecycleSelect";
import { EventPrioritySelect } from "@/modules/events/components/EventPrioritySelect";
import { ConfirmEventActionModal } from "@/modules/events/components/ConfirmEventActionModal";

interface EventActionsProps {
  event: Event;
  onChanged: () => void;
}

type ModalKind = "archive" | "cancel" | "complete" | null;

/**
 * Terminal behavior follows core/workflows/eventWorkflow.ts exclusively —
 * isEventTerminal(status) is true for completed/cancelled/archived, and
 * that single check gates every operational control here (Edit, Complete,
 * Cancel, Status/Lifecycle/Priority selects). Archive stays available even
 * from completed/cancelled (the data layer allows it — only "already
 * archived" is rejected), matching archiveEvent()'s own rule. Restore is
 * reversible, so it's the only action here without a confirmation modal.
 */
export function EventActions({ event, onChanged }: EventActionsProps) {
  const [modal, setModal] = useState<ModalKind>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const isArchived = event.status === "archived";
  const isLocked = isEventTerminal(event.status);

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreError(null);
    const result = await restoreEvent(event.id);
    setRestoring(false);
    if (!result.success) {
      setRestoreError(result.error);
      return;
    }
    onChanged();
  };

  if (isArchived) {
    return (
      <div className="space-y-3">
        <Button variant="secondary" onClick={handleRestore} disabled={restoring}>
          {restoring ? "Restoring…" : "Restore"}
        </Button>
        {restoreError ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {restoreError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!isLocked ? (
          <Link href={`/events/${event.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        ) : null}
        {!isLocked ? (
          <Button variant="secondary" onClick={() => setModal("complete")}>
            Complete Event
          </Button>
        ) : null}
        {!isLocked ? (
          <Button variant="secondary" onClick={() => setModal("cancel")}>
            Cancel Event
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => setModal("archive")}>
          Archive
        </Button>
      </div>

      {!isLocked ? (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-muted">Status</span>
            <EventStatusSelect eventId={event.id} status={event.status} onChanged={onChanged} />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-muted">Lifecycle stage</span>
            <EventLifecycleSelect eventId={event.id} stage={event.lifecycle_stage} onChanged={onChanged} />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-muted">Priority</span>
            <EventPrioritySelect eventId={event.id} priority={event.priority} onChanged={onChanged} />
          </div>
        </div>
      ) : null}

      <ConfirmEventActionModal
        open={modal === "archive"}
        onClose={() => setModal(null)}
        title="Archive Event"
        description={`This archives "${event.title}". It will be hidden from the active Events list until restored.`}
        confirmLabel="Archive"
        pendingLabel="Archiving…"
        onConfirm={() => archiveEvent(event.id)}
        onConfirmed={onChanged}
      />
      <ConfirmEventActionModal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel Event"
        description={`This marks "${event.title}" as cancelled — a terminal state that can't be undone from here.`}
        confirmLabel="Cancel Event"
        pendingLabel="Cancelling…"
        onConfirm={() => cancelEvent(event.id)}
        onConfirmed={onChanged}
      />
      <ConfirmEventActionModal
        open={modal === "complete"}
        onClose={() => setModal(null)}
        title="Complete Event"
        description={`This marks "${event.title}" as completed — a terminal state that can't be undone from here.`}
        confirmLabel="Complete Event"
        pendingLabel="Completing…"
        onConfirm={() => completeEvent(event.id)}
        onConfirmed={onChanged}
      />
    </div>
  );
}
