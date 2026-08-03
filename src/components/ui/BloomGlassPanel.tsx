import { forwardRef, type HTMLAttributes } from "react";

/**
 * Checkpoint 19.3, Step 2/1 — a floating/overlaid surface that reads as
 * "above" the page rather than a hard opaque card: a translucent tint over
 * a soft blur (`.bloom-glass` in globals.css), reusing the same warm
 * color-mix family as every other shadow/border token rather than
 * introducing a new palette. Reach for this specifically for surfaces that
 * float over real page content (a command palette, a floating toolbar) —
 * NOT a general Card replacement, since most cards sit inline in the normal
 * document flow and don't benefit from a blur that has nothing behind it.
 */
export const BloomGlassPanel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function BloomGlassPanel({ className = "", ...props }, ref) {
    return <div ref={ref} className={`bloom-glass rounded-lg ${className}`} {...props} />;
  },
);
