import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

// GLOBAL-VISUAL-04R — geometry ported to AF's real Select primitive
// (src/design-system/primitives/select.tsx, HEAD 1587d1f): same `h-10
// px-3 py-2`, border-color-only focus, no shadow/ring, and the same
// `rounded-[0.625rem]` radius-collision fix — see Input.tsx for the full
// rationale, which applies identically here.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = "", invalid = false, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`w-full h-10 rounded-[0.625rem] border bg-surface px-3 py-2 text-sm text-text transition-colors duration-150 hover:border-text/45 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-55 ${
        invalid ? "border-danger" : "border-border"
      } ${className}`}
      {...props}
    />
  );
});
