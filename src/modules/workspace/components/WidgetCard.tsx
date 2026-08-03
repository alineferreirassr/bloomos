"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface WidgetCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  customizing?: boolean;
  pinned?: boolean;
  onHide?: () => void;
  onTogglePin?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

/**
 * v2.0 Checkpoint 38, Step 12 — shared chrome for every Workspace widget.
 * In customize mode, exposes the same pin/hide/reorder controls the
 * widget layout engine (`core/workspace/widgetRegistry.ts`) already
 * supports — this component only renders the controls, it never decides
 * layout logic itself.
 */
export function WidgetCard({ title, description, children, className = "", customizing = false, pinned = false, onHide, onTogglePin, onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true }: WidgetCardProps) {
  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-base font-semibold text-text">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
        </div>
        {customizing ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="ghost" aria-label={`Move ${title} up`} disabled={!canMoveUp} onClick={onMoveUp} className="!px-1.5 text-xs">
              ↑
            </Button>
            <Button type="button" variant="ghost" aria-label={`Move ${title} down`} disabled={!canMoveDown} onClick={onMoveDown} className="!px-1.5 text-xs">
              ↓
            </Button>
            <Button type="button" variant={pinned ? "primary" : "ghost"} aria-pressed={pinned} onClick={onTogglePin} className="!px-2 text-xs">
              {pinned ? "Pinned" : "Pin"}
            </Button>
            <Button type="button" variant="secondary" onClick={onHide} className="!px-2 text-xs">
              Hide
            </Button>
          </div>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
