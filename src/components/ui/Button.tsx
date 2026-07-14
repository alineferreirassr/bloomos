import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/* Outline buttons, not filled — matches .btn-primary/.btn-secondary/.btn-ghost
   in the approved design system exactly (transparent background by default,
   a soft accent/text tint only on hover/active). */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-accent text-accent hover:bg-accent/12 active:bg-accent/22",
  secondary:
    "border border-border text-text hover:bg-text/7 active:bg-text/14",
  ghost: "text-accent px-2 hover:bg-accent/10 active:bg-accent/18",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-3.5 py-2 font-serif text-[13px] font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
