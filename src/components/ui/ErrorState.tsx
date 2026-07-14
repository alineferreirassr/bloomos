interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Something went wrong loading this data.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <p className="text-base font-medium text-text">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
