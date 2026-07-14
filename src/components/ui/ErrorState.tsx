interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Something went wrong loading this data.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface px-6 py-20 text-center">
      <p className="text-base font-medium tracking-tight text-text">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text transition-colors duration-150 hover:bg-surface-muted"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
