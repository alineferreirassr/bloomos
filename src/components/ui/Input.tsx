import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

// GLOBAL-VISUAL-04R — geometry/behavior ported to AF Digital Studio OS's
// real Input primitive (src/design-system/primitives/input.tsx, HEAD
// 1587d1f): `h-10` (40px, was 36px), `px-3 py-2` (was px-2.5 py-1.5), no
// shadow, no focus ring — AF's own field only changes border color on
// focus/hover, relying on the browser's own default focus outline for
// visibility rather than a custom ring. One primitive, every CRM (and
// non-CRM) search/filter/form input already consumes it. Radius uses the
// arbitrary value `rounded-[0.625rem]` rather than the `rounded-md` class
// name — mechanically verified on live staging that BloomOS's own
// `--radius-md` (14px) collides with, but doesn't equal, AF's real
// `--radius-md` (0.625rem/10px) despite the identical class name, the
// same rounded-lg-collision pattern caught in GLOBAL-VISUAL-03B.3.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`w-full h-10 rounded-[0.625rem] border bg-surface px-3 py-2 text-sm text-text transition-colors duration-150 placeholder:text-text-muted hover:border-text/45 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-55 ${
        invalid ? "border-danger" : "border-border"
      } ${className}`}
      {...props}
    />
  );
});
