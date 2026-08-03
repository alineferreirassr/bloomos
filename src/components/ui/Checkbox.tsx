"use client";

import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean;
}

/**
 * A native `<input type="checkbox">`, not a custom-drawn control — free
 * keyboard support, native `checked`/`disabled` semantics, and correct
 * screen-reader announcement come for free this way.
 *
 * `indeterminate` is a DOM property, not an HTML attribute — there's no JSX
 * prop for it, so it's applied imperatively to the underlying node via
 * `useEffect`, the standard way every native indeterminate-checkbox
 * implementation handles this (e.g. a "select all" checkbox whose rows are
 * only partially selected).
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { indeterminate = false, className = "", ...props },
  forwardedRef,
) {
  const innerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      className={`h-4 w-4 shrink-0 rounded-[4px] border border-border text-accent accent-accent transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45 ${className}`}
      {...props}
    />
  );
});
