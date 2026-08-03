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
        className={`min-h-[90px] w-full resize-y rounded-md border bg-transparent px-2.5 py-1.5 text-sm text-text transition-colors duration-150 placeholder:text-text-muted hover:border-text/45 focus-visible:border-accent focus-visible:outline-none ${
          invalid ? "border-danger" : "border-border"
        } ${className}`}
        {...props}
      />
    );
  },
);
