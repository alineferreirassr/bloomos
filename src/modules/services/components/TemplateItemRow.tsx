"use client";

import type { ReactNode } from "react";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { Tooltip } from "@/components/ui/Tooltip";
import { LockIcon } from "@/components/ui/icons";

interface TemplateItemRowProps {
  /** A drag affordance (typically a grip icon) — rendering it is the caller's job; this shell only positions it and hides it once `locked`, since a published version's item order can never change. */
  dragHandle?: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  /** Status/count badges, positioned next to the label. */
  metadata?: ReactNode;
  /** A small inline editable field (e.g. a quantity input) — this shell has no opinion on what it is, only where it sits. */
  inlineField?: ReactNode;
  /** Typically a button that opens a fuller inspector/drawer for this item. */
  inspectorTrigger?: ReactNode;
  actions?: ActionMenuAction[];
  saving?: boolean;
  error?: string;
  disabled?: boolean;
  /** True once the owning ServiceVersion has been published — published versions are immutable forever, so this always implies read-only regardless of `disabled`, and shows a lock affordance explaining why. */
  locked?: boolean;
  className?: string;
}

/**
 * The one shared shell every one of the 16 template-category adapters will
 * compose (a future checkpoint) — this checkpoint builds only the shell:
 * layout, saving/error/disabled/locked presentation, and slots for
 * category-specific content. No category-specific business field lives
 * here.
 */
export function TemplateItemRow({
  dragHandle,
  label,
  description,
  metadata,
  inlineField,
  inspectorTrigger,
  actions,
  saving = false,
  error,
  disabled = false,
  locked = false,
  className = "",
}: TemplateItemRowProps) {
  const isReadOnly = disabled || locked;

  return (
    <div
      aria-disabled={isReadOnly || undefined}
      className={`flex items-start gap-3 rounded-md border border-border px-3 py-2.5 ${isReadOnly ? "opacity-70" : ""} ${className}`}
    >
      {!locked && dragHandle ? <div className="mt-0.5 shrink-0 cursor-grab text-text-muted">{dragHandle}</div> : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text">{label}</span>
          {metadata}
          {locked ? (
            <Tooltip content="This version is published and can no longer be edited.">
              <LockIcon tabIndex={0} className="h-3.5 w-3.5 text-text-muted" />
            </Tooltip>
          ) : null}
          {saving ? <span className="text-xs text-text-muted">Saving…</span> : null}
        </div>
        {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
        {inlineField ? <div className="mt-1.5">{inlineField}</div> : null}
        {error ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {inspectorTrigger}
        {actions && actions.length > 0 ? <ActionMenu actions={actions} /> : null}
      </div>
    </div>
  );
}
