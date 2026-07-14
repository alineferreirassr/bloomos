import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/* Matches the approved spec: "Texto centralizado, opacidade reduzida, sem
   ilustração" — centered text, reduced opacity, no illustration. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-16 text-center">
      <p className="text-sm text-text/55">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs text-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
