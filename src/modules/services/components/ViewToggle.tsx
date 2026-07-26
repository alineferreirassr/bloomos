import { GridViewIcon, ListViewIcon } from "@/components/ui/icons";

export type CatalogViewMode = "grid" | "list";

interface ViewToggleProps {
  value: CatalogViewMode;
  onChange: (value: CatalogViewMode) => void;
  className?: string;
}

const OPTIONS: { mode: CatalogViewMode; label: string; Icon: typeof GridViewIcon }[] = [
  { mode: "grid", label: "Grid", Icon: GridViewIcon },
  { mode: "list", label: "List", Icon: ListViewIcon },
];

/** A two-way toggle, not a menu — `role="group"` with two `aria-pressed` buttons is the correct pattern for a small set of mutually exclusive view choices that should all stay visible. */
export function ViewToggle({ value, onChange, className = "" }: ViewToggleProps) {
  return (
    <div role="group" aria-label="View mode" className={`inline-flex overflow-hidden rounded-md border border-border ${className}`}>
      {OPTIONS.map(({ mode, label, Icon }) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            aria-label={`${label} view`}
            onClick={() => onChange(mode)}
            className={`flex h-9 w-9 items-center justify-center transition-colors duration-150 ${
              active ? "bg-accent/12 text-accent" : "text-text-muted hover:bg-text/7 hover:text-text"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
