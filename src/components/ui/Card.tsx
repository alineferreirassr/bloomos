import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

/* .card — no fill, thin divider border only. Matches the approved design's
   restraint: cards are defined by their border, not by a white surface. */
export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-md border border-border bg-transparent p-3.5 ${className}`}
      {...props}
    />
  );
}
