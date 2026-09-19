import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

// GLOBAL-VISUAL-04R — geometry ported to AF's real Textarea primitive
// (src/design-system/primitives/textarea.tsx, HEAD 1587d1f): `min-h-20
// px-3 py-2 leading-relaxed`, border-color-only focus — see Input.tsx.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className = "", invalid = false, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`min-h-20 w-full resize-y rounded-md border bg-surface px-3 py-2 text-sm leading-relaxed text-text transition-colors duration-150 placeholder:text-text-muted hover:border-text/45 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-55 ${
          invalid ? "border-danger" : "border-border"
        } ${className}`}
        {...props}
      />
    );
  },
);
