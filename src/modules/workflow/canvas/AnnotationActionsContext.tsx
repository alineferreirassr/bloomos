"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkflowAnnotationRenderData } from "@/modules/workflow/canvas/graphAdapters";

export interface AnnotationActions {
  updateAnnotationData: (annotationId: string, patch: Partial<Pick<WorkflowAnnotationRenderData, "text" | "color">>) => void;
  readOnly: boolean;
}

const NOOP_ACTIONS: AnnotationActions = { updateAnnotationData: () => {}, readOnly: true };

/**
 * v2.0 Checkpoint 39 addendum (Workflow Studio) — the same "safe client
 * lookup, real mutation owned elsewhere" shape `NodeCatalogContext`/
 * `NodeStatusContext` already use, this time so the Comment/Group node
 * renderers (which only receive `NodeProps`, never a direct reference to
 * `useCanvasController`) can still edit their own annotation's text/color.
 */
const AnnotationActionsContext = createContext<AnnotationActions>(NOOP_ACTIONS);

export function AnnotationActionsProvider({ actions, children }: { actions: AnnotationActions; children: ReactNode }) {
  return <AnnotationActionsContext.Provider value={actions}>{children}</AnnotationActionsContext.Provider>;
}

export function useAnnotationActions(): AnnotationActions {
  return useContext(AnnotationActionsContext);
}
