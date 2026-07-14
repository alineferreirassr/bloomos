interface ComingSoonProps {
  moduleLabel: string;
}

export function ComingSoon({ moduleLabel }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-20 text-center">
      <p className="text-sm font-medium text-accent">Coming soon</p>
      <h2 className="mt-2 text-xl font-semibold text-text">{moduleLabel}</h2>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        This module hasn&apos;t been built yet — it&apos;s next up in the
        Sprint 1 plan. See <code>ROADMAP.md</code> for the implementation
        order.
      </p>
    </div>
  );
}
