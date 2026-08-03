"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { useTransitionEventServiceStatus } from "@/modules/services/hooks/useEventAssignmentMutations";
import { useServicesPermissions } from "@/modules/services/hooks/useServicesPermissions";
import { canTransitionEventServiceStatus, type EventServiceStatus } from "@/core/workflows/eventServiceWorkflow";

interface WorkspaceActionsProps {
  eventServiceId: string;
  eventId: string;
  clientId: string;
  serviceId: string;
  status: EventServiceStatus;
}

/**
 * Only the four transitions the domain actually has (see
 * `eventServiceWorkflow.ts`'s `EVENT_SERVICE_TRANSITIONS`) get a button —
 * "Pause"/"Resume" from the checkpoint spec's own example list have no
 * corresponding `EventServiceStatus` value (the enum is exactly
 * proposed/confirmed/in_progress/completed/cancelled), and inventing a
 * "paused" state would be a schema change, not a workspace UI concern.
 * "Confirm"/"Start Service"/"Complete"/"Cancel" are the real, honest labels
 * for proposed→confirmed, confirmed→in_progress, in_progress→completed, and
 * any non-terminal→cancelled respectively.
 */
const FORWARD_TRANSITIONS: Array<{ to: EventServiceStatus; label: string }> = [
  { to: "confirmed", label: "Confirm" },
  { to: "in_progress", label: "Start Service" },
  { to: "completed", label: "Complete" },
];

export function WorkspaceActions({ eventServiceId, eventId, clientId, serviceId, status }: WorkspaceActionsProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const transition = useTransitionEventServiceStatus(eventServiceId, eventId, serviceId);
  const { canChangeStatus, disabledReason } = useServicesPermissions();

  const nextForward = FORWARD_TRANSITIONS.find(({ to }) => canTransitionEventServiceStatus(status, to));
  const canCancel = canTransitionEventServiceStatus(status, "cancelled");

  const forwardButton = nextForward ? (
    <Button
      type="button"
      variant="primary"
      disabled={!canChangeStatus || transition.isPending}
      onClick={() => transition.mutate(nextForward.to)}
    >
      {transition.isPending ? "Working…" : nextForward.label}
    </Button>
  ) : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {forwardButton ? (!canChangeStatus && disabledReason ? <Tooltip content={disabledReason}>{forwardButton}</Tooltip> : forwardButton) : null}

      {canCancel ? (
        <Button type="button" variant="secondary" disabled={!canChangeStatus} onClick={() => setConfirmCancel(true)}>
          Cancel
        </Button>
      ) : null}

      <Link href={`/events/${eventId}`}>
        <Button type="button" variant="ghost">
          View Event
        </Button>
      </Link>
      <Link href={`/clients/${clientId}`}>
        <Button type="button" variant="ghost">
          View Client
        </Button>
      </Link>

      {transition.isError ? (
        <p role="alert" className="text-xs text-danger">
          {(transition.error as { message?: string })?.message ?? "Something went wrong."}
        </p>
      ) : null}

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel this assignment?">
        <p>This assignment will be marked cancelled. It will no longer count toward this Service&rsquo;s usage, and its overrides/status can no longer be changed.</p>
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            onClick={() => {
              transition.mutate("cancelled", { onSuccess: () => setConfirmCancel(false) });
            }}
            disabled={transition.isPending}
          >
            {transition.isPending ? "Cancelling…" : "Cancel assignment"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setConfirmCancel(false)}>
            Keep assignment
          </Button>
        </div>
      </Modal>
    </div>
  );
}
