"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { useDialogBehavior } from "@/components/ui/useDialogBehavior";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({ open, onClose, containerRef: dialogRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-index-modal)] grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-800/50"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex w-full max-w-[440px] flex-col gap-3.5 rounded-lg border border-border bg-surface p-4 shadow-md focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-xl font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="text-sm text-text/85">{children}</div>
      </div>
    </div>
  );
}
