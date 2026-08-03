"use client";

import { useEffect, useRef } from "react";
import { matchesShortcut } from "@/core/commandPalette/shortcuts";

/**
 * Fires `handler` whenever `shortcut` (e.g. "mod+k") is pressed anywhere in
 * the document. `handler` is read through a ref (same reasoning as
 * `useDialogBehavior`'s `onCloseRef`) so a fresh inline closure on every
 * render doesn't force a listener remove/re-add — only a change to
 * `shortcut` or `enabled` does that.
 */
export function useKeyboardShortcut(shortcut: string, handler: () => void, enabled = true): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        handlerRef.current();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcut, enabled]);
}
