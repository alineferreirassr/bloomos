"use client";

import { cloneElement, isValidElement, useEffect, useId, useState, type FocusEvent, type MouseEvent, type ReactElement, type ReactNode } from "react";

const SHOW_DELAY_MS = 400;

type TriggerProps = {
  onMouseEnter?: (event: MouseEvent) => void;
  onMouseLeave?: (event: MouseEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  "aria-describedby"?: string;
};

interface TooltipProps {
  content: ReactNode;
  children: ReactElement<TriggerProps>;
  placement?: "top" | "bottom";
}

/**
 * Shows on hover AND keyboard focus (never hover-only — a keyboard user who
 * tabs to the trigger must see the same tooltip a mouse user gets), after a
 * short delay so it doesn't flash on every incidental mouse pass-through.
 * `visible` is derived (`active && elapsed`) rather than set directly from
 * inside the delay effect, so the effect only ever schedules one thing
 * (flip `elapsed` once the delay passes) instead of also synchronously
 * unsetting state on every render where `active` is already false.
 * `aria-describedby` links the trigger to the tooltip text directly rather
 * than relying on hover proximity, so screen readers announce it too — it's
 * applied to the actual trigger element via `cloneElement`, not a wrapping
 * `<span>`, since `aria-describedby` is only honored on the element that
 * receives focus.
 *
 * Deliberately supplementary only — never wrap the *only* place some
 * critical fact appears (why a button is disabled, a validation error) in a
 * Tooltip alone: it's invisible on touch devices and to anyone who never
 * hovers/focuses the trigger. Put that text somewhere always-visible and
 * reach for Tooltip for genuinely optional context.
 */
export function Tooltip({ content, children, placement = "top" }: TooltipProps) {
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(false);
  const visible = active && elapsed;
  const id = useId();

  useEffect(() => {
    if (!active) return;
    const timeout = setTimeout(() => setElapsed(true), SHOW_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [active]);

  if (!isValidElement(children)) return children;

  const childProps = children.props;
  const trigger = cloneElement(children, {
    onMouseEnter: (event: MouseEvent) => {
      childProps.onMouseEnter?.(event);
      setActive(true);
    },
    onMouseLeave: (event: MouseEvent) => {
      childProps.onMouseLeave?.(event);
      setActive(false);
      setElapsed(false);
    },
    onFocus: (event: FocusEvent) => {
      childProps.onFocus?.(event);
      setActive(true);
    },
    onBlur: (event: FocusEvent) => {
      childProps.onBlur?.(event);
      setActive(false);
      setElapsed(false);
    },
    "aria-describedby": visible ? id : childProps["aria-describedby"],
  });

  return (
    <span className="relative inline-flex">
      {trigger}
      {visible && (
        <span
          role="tooltip"
          id={id}
          className={`bloom-elevation-popover pointer-events-none absolute left-1/2 z-[var(--z-index-tooltip)] w-max max-w-56 -translate-x-1/2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
