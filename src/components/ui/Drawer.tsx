"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { useDialogBehavior } from "@/components/ui/useDialogBehavior";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Same dialog behavior as Modal (focus trap, Escape, focus-return,
 * scroll-lock via `useDialogBehavior`) — the only real difference is
 * layout: an edge-anchored panel rather than a centered card, for content
 * that's too long or too task-focused to interrupt with a centered Modal
 * while still keeping the triggering page dimmed and unreachable behind it.
 * Like Modal, it mounts/unmounts instantly rather than sliding in — no
 * primitive in this codebase animates dialog entry, so there's nothing for
 * `prefers-reduced-motion` to need to suppress here.
 */
export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({ open, onClose, containerRef: panelRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-index-modal)] flex justify-end">
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-neutral-800/50" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[420px] flex-col gap-3.5 border-l border-border bg-surface p-4 shadow-[var(--shadow-lg-val)] focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-xl font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto text-sm text-text/85">{children}</div>
      </div>
    </div>
  );
}
