"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TemplateItemInspectorForm } from "@/modules/services/components/TemplateItemInspectorForm";
import type { TemplateCategoryAdapter } from "@/modules/services/templateCategoryAdapters";

interface TemplateInspectorDrawerProps<TRow extends { id: string }, TInput extends Record<string, unknown>> {
  adapter: TemplateCategoryAdapter<TRow, TInput>;
  open: boolean;
  /** `null` when adding a new row. */
  row: TRow | null;
  onClose: () => void;
  onSave: (input: TInput) => Promise<unknown>;
  readOnly: boolean;
  readOnlyReason?: string;
}

/**
 * Wraps the shared Drawer primitive (focus trap/Escape/focus-return already
 * built into it) with the one behavior specific to this Inspector: closing
 * while dirty asks for confirmation first. `Drawer` itself unmounts its
 * children whenever `open` is false, so the form's state (and the work of
 * building it) never exists until the Inspector is actually opened —
 * satisfying "Inspector should render lazily" for free, with no extra
 * lazy-loading machinery of our own.
 */
export function TemplateInspectorDrawer<TRow extends { id: string }, TInput extends Record<string, unknown>>({
  adapter,
  open,
  row,
  onClose,
  onSave,
  readOnly,
  readOnlyReason,
}: TemplateInspectorDrawerProps<TRow, TInput>) {
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  function requestClose() {
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }

  function discardAndClose() {
    setDirty(false);
    setConfirmingDiscard(false);
    onClose();
  }

  async function handleSave(input: TInput) {
    await onSave(input);
    setDirty(false);
    onClose();
  }

  const title = row ? `Edit ${adapter.itemNoun}` : `Add ${adapter.itemNoun}`;

  return (
    <>
      <Drawer open={open} onClose={requestClose} title={title}>
        <TemplateItemInspectorForm
          key={row?.id ?? "new"}
          adapter={adapter}
          row={row}
          onSave={handleSave}
          onCancel={requestClose}
          onDirtyChange={setDirty}
          readOnly={readOnly}
          readOnlyReason={readOnlyReason}
        />
      </Drawer>

      <Modal open={confirmingDiscard} onClose={() => setConfirmingDiscard(false)} title="Discard unsaved changes?">
        <p>{`Your edits to this ${adapter.itemNoun} haven't been saved.`}</p>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={discardAndClose}>
            Discard
          </Button>
          <Button type="button" variant="secondary" onClick={() => setConfirmingDiscard(false)}>
            Keep editing
          </Button>
        </div>
      </Modal>
    </>
  );
}
