/** A non-blocking nudge shown above the category list when a draft version has no template content at all yet — the 16 category sections themselves still render underneath (each with its own empty state), never hidden in favor of this banner. */
export function TemplateBuilderEmptyState() {
  return (
    <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-text-muted">
      Nothing added yet. Start with the categories marked <span className="font-medium text-text">Expected</span> below.
    </div>
  );
}
