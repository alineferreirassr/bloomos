import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = "", invalid = false, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`w-full min-h-9 rounded-md border bg-surface px-2.5 py-1.5 text-sm text-text shadow-sm transition-colors duration-150 hover:border-text/45 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none ${
        invalid ? "border-danger" : "border-border"
      } ${className}`}
      {...props}
    />
  );
});
