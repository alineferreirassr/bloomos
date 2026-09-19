"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ErrorState } from "@/components/ui/ErrorState";
import { listScriptBlocksAction, createScriptBlockAction, updateScriptBlockAction, removeScriptBlockAction } from "@/modules/script/scriptActions";
import type { ScriptBlock } from "@/types/scriptBlock";

type BlocksState = { status: "loading" } | { status: "error" } | { status: "ready"; blocks: ScriptBlock[] };

interface ScriptBlockEditorProps {
  scriptVersionId: string;
  /** Whether the caller holds social.create — Add/Save/Remove are hidden, not merely disabled, for a read-only viewer. The Server Actions themselves are still the real enforcement boundary. */
  canManage: boolean;
}

/**
 * SOCIAL-08D — the ordered Script Block editor, backend-authoritative like
 * every other list in this codebase: it reloads from `listScriptBlocksAction`
 * rather than trusting locally-mutated state to stay in sync with the
 * server. Plain text only — no rich text editor, no `dangerouslySetInnerHTML`.
 * Ordering is a plain "Position" number input rather than drag-and-drop —
 * no drag interaction was in this checkpoint's explicit scope, and a
 * numeric input keeps `sort_order` fully accessible (keyboard/screen
 * reader) without a new dependency.
 */
export function ScriptBlockEditor({ scriptVersionId, canManage }: ScriptBlockEditorProps) {
  const [state, setState] = useState<BlocksState>({ status: "loading" });
  const [addingBlock, setAddingBlock] = useState(false);

  function load() {
    listScriptBlocksAction(scriptVersionId).then((result) => {
      setState(result.success ? { status: "ready", blocks: result.data } : { status: "error" });
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the version itself changes, matching every other list view's own [dependency] shape in this codebase
  }, [scriptVersionId]);

  function handleBlockChanged(updated: ScriptBlock) {
    setState((prev) =>
      prev.status === "ready" ? { status: "ready", blocks: prev.blocks.map((b) => (b.id === updated.id ? updated : b)).sort((a, b) => a.sort_order - b.sort_order) } : prev,
    );
  }

  function handleBlockRemoved(id: string) {
    setState((prev) => (prev.status === "ready" ? { status: "ready", blocks: prev.blocks.filter((b) => b.id !== id) } : prev));
  }

  async function handleAddBlock() {
    setAddingBlock(true);
    try {
      const nextOrder = state.status === "ready" && state.blocks.length > 0 ? Math.max(...state.blocks.map((b) => b.sort_order)) + 1 : 0;
      const result = await createScriptBlockAction(scriptVersionId, { content: "", sort_order: nextOrder });
      if (result.success) load();
    } finally {
      setAddingBlock(false);
    }
  }

  if (state.status === "loading") {
    return <p className="text-xs text-text-muted">Loading blocks…</p>;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load Script blocks." onRetry={load} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {state.blocks.length === 0 ? <p className="text-xs text-text-muted">No blocks yet.</p> : null}
      {state.blocks.map((block) => (
        <ScriptBlockRow
          key={block.id}
          scriptVersionId={scriptVersionId}
          block={block}
          onChanged={handleBlockChanged}
          onRemoved={handleBlockRemoved}
          canManage={canManage}
        />
      ))}
      {canManage ? (
        <Button type="button" variant="secondary" onClick={handleAddBlock} disabled={addingBlock} aria-busy={addingBlock}>
          {addingBlock ? "Adding…" : "Add Block"}
        </Button>
      ) : null}
    </div>
  );
}

interface ScriptBlockRowProps {
  scriptVersionId: string;
  block: ScriptBlock;
  onChanged: (block: ScriptBlock) => void;
  onRemoved: (id: string) => void;
  canManage: boolean;
}

function ScriptBlockRow({ scriptVersionId, block, onChanged, onRemoved, canManage }: ScriptBlockRowProps) {
  const [content, setContent] = useState(block.content);
  const [sortOrder, setSortOrder] = useState(block.sort_order);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const result = await updateScriptBlockAction(scriptVersionId, block.id, { content, sort_order: sortOrder });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onChanged(result.data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      const result = await removeScriptBlockAction(scriptVersionId, block.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onRemoved(block.id);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor={`script-block-position-${block.id}`} className="text-xs font-medium text-text-muted">
            Position
          </label>
          <Input
            id={`script-block-position-${block.id}`}
            type="number"
            min="0"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            disabled={!canManage || busy}
            className="w-20"
          />
        </div>
        {canManage ? (
          <Button type="button" variant="ghost" onClick={handleRemove} disabled={busy}>
            Remove
          </Button>
        ) : null}
      </div>

      <div>
        <label htmlFor={`script-block-content-${block.id}`} className="mb-1 block text-xs font-medium text-text-muted">
          Content
        </label>
        <Textarea
          id={`script-block-content-${block.id}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!canManage || busy}
        />
      </div>

      {canManage ? (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={handleSave} disabled={busy} aria-busy={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
