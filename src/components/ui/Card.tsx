import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(46,42,39,0.04)] transition-colors duration-150 sm:p-7 ${className}`}
      {...props}
    />
  );
}
