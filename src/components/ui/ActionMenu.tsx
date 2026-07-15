"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ActionMenuAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

/**
 * A small dropdown for per-row item actions (Checklist, Schedule). Not a
 * heavier design-system menu with submenus/icons — every other list in the
 * app uses plain inline buttons, so this stays intentionally minimal.
 * Visually it borrows straight from Modal (border-border, bg-surface,
 * shadow-md).
 */
export function ActionMenu({ actions }: { actions: ActionMenuAction[] }): ReactNode {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Item actions"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ⋯
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-border bg-surface py-1 shadow-md"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-text/7 ${
                action.destructive ? "text-danger" : "text-text"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
