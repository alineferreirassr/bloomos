import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`w-full min-h-9 rounded-md border bg-surface px-2.5 py-1.5 text-sm text-text shadow-sm transition-colors duration-150 placeholder:text-text-muted hover:border-text/45 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none ${
        invalid ? "border-danger" : "border-border"
      } ${className}`}
      {...props}
    />
  );
});
