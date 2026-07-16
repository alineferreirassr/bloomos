"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { activateDocument, archiveDocument, expireDocument, restoreDocument, softDeleteDocument } from "@/lib/data";
import type { Document } from "@/types/document";
import { canTransitionDocumentStatus, isDocumentTerminal } from "@/core/workflows/documentWorkflow";
import { ConfirmDocumentActionModal } from "@/modules/documents/components/ConfirmDocumentActionModal";
import { ChangeVisibilityModal } from "@/modules/documents/components/ChangeVisibilityModal";
import { MoveToFolderModal } from "@/modules/documents/components/MoveToFolderModal";
import { NewVersionModal } from "@/modules/documents/components/NewVersionModal";

interface DocumentActionsProps {
  document: Document;
  onChanged: (document: Document) => void;
}

type ModalKind = "expire" | "archive" | "softDelete" | "visibility" | "moveToFolder" | "newVersion" | null;

/**
 * Every transition here goes through the existing dedicated data-layer
 * action (never a hardcoded status write) — activateDocument/
 * createDocumentVersion/expireDocument/archiveDocument/restoreDocument/
 * softDeleteDocument, exactly the set built in the Documents domain
 * foundation. Confirmation modals gate Expire/Archive/Soft Delete
 * (terminal-or-destructive); Activate and Restore are procedural/reversible
 * forward-motion steps, the same reasoning as InvoiceActions/ExpenseActions.
 */
export function DocumentActions({ document, onChanged }: DocumentActionsProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDeleted = document.status === "deleted";
  const canActivate = canTransitionDocumentStatus(document.status, "active");
  const canRestore = (document.status === "archived" || document.status === "deleted") && canActivate;
  const canExpire = canTransitionDocumentStatus(document.status, "expired");
  const canArchive = canTransitionDocumentStatus(document.status, "archived");
  const canSoftDelete = canTransitionDocumentStatus(document.status, "deleted");
  const canEdit = !isDeleted;
  const canAddVersion = !isDeleted;

  const runAction = async (name: string, action: () => Promise<{ success: boolean; error?: string; data?: Document }>) => {
    setBusyAction(name);
    setActionError(null);
    const result = await action();
    setBusyAction(null);
    if (!result.success) {
      setActionError(result.error ?? "Something went wrong.");
      return;
    }
    if (result.data) onChanged(result.data);
  };

  if (document.status === "archived" || isDeleted) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {canRestore ? (
            <Button
              variant="secondary"
              onClick={() => runAction("restore", () => restoreDocument(document.id))}
              disabled={busyAction === "restore"}
            >
              {busyAction === "restore" ? "Restoring…" : "Restore"}
            </Button>
          ) : null}
        </div>
        {actionError ? (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
            {actionError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <Link href={`/documents/${document.id}/edit`}>
            <Button variant="secondary">Edit Metadata</Button>
          </Link>
        ) : null}
        {canActivate ? (
          <Button
            variant="secondary"
            onClick={() => runAction("activate", () => activateDocument(document.id))}
            disabled={busyAction === "activate"}
          >
            {busyAction === "activate" ? "Activating…" : "Activate"}
          </Button>
        ) : null}
        {canAddVersion ? (
          <Button variant="secondary" onClick={() => setModal("newVersion")}>
            Add New Version
          </Button>
        ) : null}
        {canEdit ? (
          <Button variant="secondary" onClick={() => setModal("visibility")}>
            Change Visibility
          </Button>
        ) : null}
        {canEdit ? (
          <Button variant="secondary" onClick={() => setModal("moveToFolder")}>
            Move to Folder
          </Button>
        ) : null}
        {canExpire ? (
          <Button variant="secondary" onClick={() => setModal("expire")}>
            Expire
          </Button>
        ) : null}
        {canArchive ? (
          <Button variant="secondary" onClick={() => setModal("archive")}>
            Archive
          </Button>
        ) : null}
        {canSoftDelete ? (
          <Button variant="secondary" onClick={() => setModal("softDelete")}>
            Soft Delete
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {actionError}
        </p>
      ) : null}

      {isDocumentTerminal(document.status) ? (
        <p className="text-xs text-text-muted">This document has been deleted and is read-only.</p>
      ) : null}

      <ConfirmDocumentActionModal
        open={modal === "expire"}
        onClose={() => setModal(null)}
        title="Expire Document"
        description={`This marks "${document.title}" as expired.`}
        confirmLabel="Expire"
        pendingLabel="Expiring…"
        onConfirm={() => expireDocument(document.id)}
        onConfirmed={onChanged}
      />
      <ConfirmDocumentActionModal
        open={modal === "archive"}
        onClose={() => setModal(null)}
        title="Archive Document"
        description={`This archives "${document.title}". It will be hidden from the active Documents list until restored.`}
        confirmLabel="Archive"
        pendingLabel="Archiving…"
        onConfirm={() => archiveDocument(document.id)}
        onConfirmed={onChanged}
      />
      <ConfirmDocumentActionModal
        open={modal === "softDelete"}
        onClose={() => setModal(null)}
        title="Soft Delete Document"
        description={`This marks "${document.title}" as deleted. It is never physically removed — the full version history and Timeline remain, and it can be restored later.`}
        confirmLabel="Soft Delete"
        pendingLabel="Deleting…"
        onConfirm={() => softDeleteDocument(document.id)}
        onConfirmed={onChanged}
      />
      <ChangeVisibilityModal
        open={modal === "visibility"}
        onClose={() => setModal(null)}
        document={document}
        onChanged={onChanged}
      />
      <MoveToFolderModal
        open={modal === "moveToFolder"}
        onClose={() => setModal(null)}
        document={document}
        onChanged={onChanged}
      />
      <NewVersionModal
        open={modal === "newVersion"}
        onClose={() => setModal(null)}
        document={document}
        onCreated={(newVersion) => router.push(`/documents/${newVersion.id}`)}
      />
    </div>
  );
}
