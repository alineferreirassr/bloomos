import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className = "", invalid = false, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-text transition-colors duration-150 placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
          invalid ? "border-danger" : "border-border"
        } ${className}`}
        {...props}
      />
    );
  },
);
