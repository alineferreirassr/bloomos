"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { reorderContractExhibits } from "@/lib/data";
import type { ContractExhibit } from "@/types/contractExhibit";
import { ExhibitForm } from "@/modules/contracts/components/ExhibitForm";
import { ConfirmDeleteExhibitModal } from "@/modules/contracts/components/ConfirmDeleteExhibitModal";

interface ExhibitsSectionProps {
  contractId: string;
  exhibits: ContractExhibit[];
  readOnly: boolean;
  onChanged: () => void;
}

type ModalState = { kind: "create" } | { kind: "edit"; exhibit: ContractExhibit } | { kind: "delete"; exhibit: ContractExhibit } | null;

/** No document upload yet — exhibits stay title/description/order only (document_id is a placeholder for the future Documents module). */
export function ExhibitsSection({ contractId, exhibits, readOnly, onChanged }: ExhibitsSectionProps) {
  const [modal, setModal] = useState<ModalState>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const sorted = [...exhibits].sort((a, b) => a.display_order - b.display_order);

  const moveExhibit = async (exhibitId: string, direction: "up" | "down") => {
    setReorderError(null);
    const index = sorted.findIndex((exhibit) => exhibit.id === exhibitId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= sorted.length) return;

    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const result = await reorderContractExhibits(contractId, reordered.map((exhibit) => exhibit.id));
    if (!result.success) {
      setReorderError(result.error);
      return;
    }
    onChanged();
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-[17px] font-semibold text-text">Exhibits</h3>
        {!readOnly ? (
          <Button variant="secondary" onClick={() => setModal({ kind: "create" })}>
            Add Exhibit
          </Button>
        ) : null}
      </div>

      {reorderError ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {reorderError}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">No exhibits attached to this contract.</p>
      ) : (
        <ul className="mt-3 space-y-2" data-testid="exhibit-list">
          {sorted.map((exhibit, index) => {
            const actions: ActionMenuAction[] = [];
            if (!readOnly) {
              actions.push({ label: "Edit", onSelect: () => setModal({ kind: "edit", exhibit }) });
              actions.push({ label: "Remove", onSelect: () => setModal({ kind: "delete", exhibit }), destructive: true });
            }
            return (
              <li
                key={exhibit.id}
                data-testid={`exhibit-${exhibit.id}`}
                className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{exhibit.title}</p>
                  {exhibit.description ? <p className="mt-0.5 text-xs text-text-muted">{exhibit.description}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!readOnly ? (
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={index === 0}
                        onClick={() => moveExhibit(exhibit.id, "up")}
                        className="flex h-5 w-6 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:pointer-events-none disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={index === sorted.length - 1}
                        onClick={() => moveExhibit(exhibit.id, "down")}
                        className="flex h-5 w-6 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:pointer-events-none disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  ) : null}
                  {!readOnly ? <ActionMenu actions={actions} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ExhibitForm
        key={modal?.kind === "edit" ? modal.exhibit.id : modal?.kind === "create" ? "create" : "closed"}
        contractId={contractId}
        exhibit={modal?.kind === "edit" ? modal.exhibit : null}
        open={modal?.kind === "create" || modal?.kind === "edit"}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          onChanged();
        }}
      />

      {modal?.kind === "delete" ? (
        <ConfirmDeleteExhibitModal
          open
          onClose={() => setModal(null)}
          exhibitId={modal.exhibit.id}
          exhibitTitle={modal.exhibit.title}
          onDeleted={onChanged}
        />
      ) : null}
    </Card>
  );
}
