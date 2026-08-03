interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Something went wrong loading this data.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-tint px-6 py-16 text-center">
      <p className="text-sm text-text/55">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-border px-3.5 py-2 font-serif text-[13px] font-semibold text-text transition-colors duration-150 hover:bg-text/7"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
