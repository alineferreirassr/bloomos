"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseDialogBehaviorOptions {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  /** Locks page scroll while open. Every current use (Modal, Drawer) wants this, but it's a separate option rather than baked in since a future non-modal overlay built on this same hook might not. */
  lockScroll?: boolean;
}

/**
 * The dialog behavior every modal-style overlay needs, regardless of how it
 * looks: trap Tab focus inside the container so the background can't be
 * tabbed into, close on Escape, move focus into the dialog on open and
 * back to whatever triggered it on close, and lock page scroll while open.
 * Pulled out once so Modal and Drawer share this instead of each
 * maintaining its own copy that quietly drifts out of sync.
 */
export function useDialogBehavior({ open, onClose, containerRef, lockScroll = true }: UseDialogBehaviorOptions) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // `onClose` is very often a fresh inline closure on every render of the
  // caller — reading it through a ref (kept current on every render, not
  // just when the dialog opens) means the setup/teardown effect below can
  // depend on `open` alone. Without this, a new `onClose` identity on any
  // re-render while the dialog is open (e.g. typing into a field inside it)
  // would re-run the effect, immediately stealing focus back to the first
  // focusable element and away from whatever the user was actually using.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    const initialFocusable = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (initialFocusable ?? container)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !container) return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !lockScroll) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, lockScroll]);
}
