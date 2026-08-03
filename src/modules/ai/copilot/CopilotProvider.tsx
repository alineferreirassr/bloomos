"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface CopilotPanelApi {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  toggle: () => void;
}

const CopilotPanelContext = createContext<CopilotPanelApi | null>(null);

/**
 * Checkpoint 20, Step 1 — owns the Copilot side panel's open/closed state
 * only. Kept deliberately separate from `CopilotPageContextProvider` (a
 * different concern: "is the panel open" vs. "where is the user") so a
 * future caller can read one without depending on the other.
 */
export function CopilotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((current) => !current), []);
  const value = useMemo(() => ({ open, openPanel, closePanel, toggle }), [open, openPanel, closePanel, toggle]);

  return <CopilotPanelContext.Provider value={value}>{children}</CopilotPanelContext.Provider>;
}

export function useCopilotPanel(): CopilotPanelApi {
  const ctx = useContext(CopilotPanelContext);
  if (!ctx) throw new Error("useCopilotPanel must be used inside CopilotProvider");
  return ctx;
}
