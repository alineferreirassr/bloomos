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
 * only partially selected). GLOBAL-VISUAL-04R — AF's own real Checkbox
 * primitive (src/design-system/primitives/checkbox.tsx, HEAD 1587d1f) is a
 * bare native checkbox styled only via `accent-color`, no custom box/border
 * or focus ring; ported that same minimal styling here, while keeping this
 * `indeterminate` behavior AF's simpler version doesn't have.
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
      className={`size-4 shrink-0 cursor-pointer rounded-[0.3rem] accent-accent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
      {...props}
    />
  );
});
