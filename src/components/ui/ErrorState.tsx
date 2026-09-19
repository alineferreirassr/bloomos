import { Button } from "@/components/ui/Button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

// GLOBAL-VISUAL-04R — the retry control was a hand-rolled <button> carrying
// its own copy of the old outline-button styling; replaced with the shared
// Button primitive (now itself AF-ported) so this state picks up the same
// fix everywhere instead of keeping a second, stale button implementation.
export function ErrorState({
  message = "Something went wrong loading this data.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-tint px-6 py-16 text-center">
      <p className="text-sm text-text/55">{message}</p>
      {onRetry ? (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      ) : null}
    </div>
  );
}
