"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  archiveContract,
  cancelContract,
  completeContract,
  duplicateContract,
  expireContract,
  markDeclined,
  markSigned,
  markViewed,
  restoreContract,
  sendContract,
} from "@/lib/data";
import type { Contract } from "@/types/contract";
import { isContractClosed, isContractFullyLocked } from "@/core/workflows/contractWorkflow";
import { ContractStatusSelect } from "@/modules/contracts/components/ContractStatusSelect";
import { ConfirmContractActionModal } from "@/modules/contracts/components/ConfirmContractActionModal";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

interface ContractActionsProps {
  contract: Contract;
  onChanged: () => void;
}

type ModalKind = "send" | "signed" | "declined" | "expire" | "cancel" | "complete" | "archive" | null;

/**
 * Every transition here goes through the existing dedicated data-layer
 * action (never a hardcoded status write) — sendContract/markViewed/
 * markSigned/markDeclined/expireContract/cancelContract/completeContract/
 * archiveContract/restoreContract/duplicateContract, exactly the set built
 * in the Contracts domain foundation. Confirmation modals gate every
 * terminal-or-destructive action (Send, Mark Signed, Mark Declined, Expire,
 * Cancel, Complete, Archive); Mark Viewed (passive), Restore (reversible),
 * and Duplicate (purely additive) skip the modal, same reasoning as
 * EventActions' Restore.
 */
export function ContractActions({ contract, onChanged }: ContractActionsProps) {
  const { can } = useMemberSession();
  const canUpdate = can("contracts.update");
  const canLifecycle = can("contracts.lifecycle");
  const canDuplicate = can("contracts.create");
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  const isArchived = contract.status === "archived";
  const canSend = contract.status === "draft" || contract.status === "review" || contract.status === "ready";
  const canMarkViewed = contract.status === "sent";
  const canMarkSigned = contract.status === "sent" || contract.status === "viewed";
  const canMarkDeclined = contract.status === "sent" || contract.status === "viewed";
  const canExpire = contract.status === "sent" || contract.status === "viewed";
  const canCancel = !isContractClosed(contract.status);
  const canComplete = contract.status === "signed";

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreError(null);
    const result = await restoreContract(contract.id);
    setRestoring(false);
    if (!result.success) {
      setRestoreError(result.error);
      return;
    }
    onChanged();
  };

  const handleMarkViewed = async () => {
    setViewing(true);
    setViewError(null);
    const result = await markViewed(contract.id);
    setViewing(false);
    if (!result.success) {
      setViewError(result.error);
      return;
    }
    onChanged();
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    setDuplicateError(null);
    const result = await duplicateContract(contract.id);
    setDuplicating(false);
    if (!result.success) {
      setDuplicateError(result.error);
      return;
    }
    router.push(`/contracts/${result.data.id}`);
  };

  const duplicateButton = canDuplicate ? (
    <div>
      <Button variant="secondary" onClick={handleDuplicate} disabled={duplicating}>
        {duplicating ? "Duplicating…" : "Duplicate"}
      </Button>
      {duplicateError ? (
        <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {duplicateError}
        </p>
      ) : null}
    </div>
  ) : null;

  if (isArchived) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {canLifecycle ? (
            <div>
              <Button variant="secondary" onClick={handleRestore} disabled={restoring}>
                {restoring ? "Restoring…" : "Restore"}
              </Button>
              {restoreError ? (
                <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {restoreError}
                </p>
              ) : null}
            </div>
          ) : null}
          {duplicateButton}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!isContractFullyLocked(contract.status) && canUpdate ? (
          <Link href={`/contracts/${contract.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        ) : null}
        {canSend && canLifecycle ? (
          <Button variant="secondary" onClick={() => setModal("send")}>
            Send Contract
          </Button>
        ) : null}
        {canMarkViewed && canLifecycle ? (
          <div>
            <Button variant="secondary" onClick={handleMarkViewed} disabled={viewing}>
              {viewing ? "Marking…" : "Mark Viewed"}
            </Button>
            {viewError ? (
              <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                {viewError}
              </p>
            ) : null}
          </div>
        ) : null}
        {canMarkSigned && canLifecycle ? (
          <Button variant="secondary" onClick={() => setModal("signed")}>
            Mark Signed
          </Button>
        ) : null}
        {canMarkDeclined && canLifecycle ? (
          <Button variant="secondary" onClick={() => setModal("declined")}>
            Mark Declined
          </Button>
        ) : null}
        {canExpire && canLifecycle ? (
          <Button variant="secondary" onClick={() => setModal("expire")}>
            Expire
          </Button>
        ) : null}
        {canComplete && canLifecycle ? (
          <Button variant="secondary" onClick={() => setModal("complete")}>
            Complete
          </Button>
        ) : null}
        {canCancel && canLifecycle ? (
          <Button variant="secondary" onClick={() => setModal("cancel")}>
            Cancel Contract
          </Button>
        ) : null}
        {canLifecycle ? (
          <Button variant="secondary" onClick={() => setModal("archive")}>
            Archive
          </Button>
        ) : null}
        {duplicateButton}
      </div>

      {!isContractFullyLocked(contract.status) && canUpdate ? (
        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Status</span>
          <ContractStatusSelect contractId={contract.id} status={contract.status} onChanged={onChanged} />
        </div>
      ) : null}

      <ConfirmContractActionModal
        open={modal === "send"}
        onClose={() => setModal(null)}
        title="Send Contract"
        description={`This marks "${contract.title}" as sent to the client. Mark Viewed/Signed/Declined become available afterward.`}
        confirmLabel="Send"
        pendingLabel="Sending…"
        onConfirm={() => sendContract(contract.id)}
        onConfirmed={onChanged}
      />
      <ConfirmContractActionModal
        open={modal === "signed"}
        onClose={() => setModal(null)}
        title="Mark Signed"
        description={`This marks "${contract.title}" as signed and locks its commercial terms from further editing.`}
        confirmLabel="Mark Signed"
        pendingLabel="Marking…"
        onConfirm={() => markSigned(contract.id)}
        onConfirmed={onChanged}
      />
      <ConfirmContractActionModal
        open={modal === "declined"}
        onClose={() => setModal(null)}
        title="Mark Declined"
        description={`This marks "${contract.title}" as declined — a terminal state that can't be undone from here.`}
        confirmLabel="Mark Declined"
        pendingLabel="Marking…"
        onConfirm={() => markDeclined(contract.id)}
        onConfirmed={onChanged}
      />
      <ConfirmContractActionModal
        open={modal === "expire"}
        onClose={() => setModal(null)}
        title="Expire Contract"
        description={`This marks "${contract.title}" as expired — a terminal state that can't be undone from here.`}
        confirmLabel="Expire"
        pendingLabel="Expiring…"
        onConfirm={() => expireContract(contract.id)}
        onConfirmed={onChanged}
      />
      <ConfirmContractActionModal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel Contract"
        description={`This marks "${contract.title}" as cancelled — a terminal state that can't be undone from here.`}
        confirmLabel="Cancel Contract"
        pendingLabel="Cancelling…"
        onConfirm={() => cancelContract(contract.id)}
        onConfirmed={onChanged}
      />
      <ConfirmContractActionModal
        open={modal === "complete"}
        onClose={() => setModal(null)}
        title="Complete Contract"
        description={`This marks "${contract.title}" as completed — a terminal state that can't be undone from here.`}
        confirmLabel="Complete"
        pendingLabel="Completing…"
        onConfirm={() => completeContract(contract.id)}
        onConfirmed={onChanged}
      />
      <ConfirmContractActionModal
        open={modal === "archive"}
        onClose={() => setModal(null)}
        title="Archive Contract"
        description={`This archives "${contract.title}". It will be hidden from the active Contracts list until restored.`}
        confirmLabel="Archive"
        pendingLabel="Archiving…"
        onConfirm={() => archiveContract(contract.id)}
        onConfirmed={onChanged}
      />
    </div>
  );
}
