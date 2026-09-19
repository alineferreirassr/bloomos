import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * GLOBAL-VISUAL-04R — fill/border relationship and sizing ported to AF's
 * real Button primitive (src/design-system/primitives/button.tsx, HEAD
 * 1587d1f): `primary` is a solid accent fill (AF's own primary is
 * `bg-accent-strong`; BloomOS has no separate "strong" accent shade, so this
 * uses the existing `--color-accent`/`--color-accent-foreground` pair, which
 * is the exact same relationship AF's OWN css variables collapse to when a
 * design has no separate hover shade), `secondary` is bordered/surface,
 * `ghost` is a soft accent-tint hover — matching AF's actual solid/bordered/
 * ghost hierarchy instead of BloomOS's prior all-outline treatment. Sizes
 * (`sm`/`md`/`lg`/`icon`) are AF's own real scale (`h-8`/`h-10`/`h-11`/
 * `size-10`); `size` defaults to `md` so every existing call site keeps its
 * current usage unchanged. The button's `font-serif` label treatment is a
 * separately-approved BloomOS design decision (see git history) unrelated
 * to this AF-fidelity pass and is intentionally left as-is.
 *
 * Each variant owns its own `border-<color>` utility (never the shared base)
 * — verified live on staging that putting `border-transparent` in the base
 * and `border-border` on `secondary` left the border transparent, since
 * Tailwind's generated stylesheet order between two same-specificity
 * border-color utilities doesn't follow their order in the class string.
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-transparent bg-accent text-accent-foreground shadow-sm hover:opacity-90 active:opacity-95",
  secondary: "border border-border bg-surface text-text hover:bg-surface-tint active:bg-surface-tint",
  ghost: "border border-transparent text-accent hover:bg-accent-100 active:bg-accent-100",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-[13px]",
  lg: "h-11 px-6 text-sm",
  icon: "size-10 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-serif font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
});
