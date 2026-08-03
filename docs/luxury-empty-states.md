# Luxury Empty States

Checkpoint 19.2, Step 4. Every module's "nothing here yet" state now carries a soft icon badge and warmer copy, replacing the generic "No data" pattern — without contradicting the Classical design system's own prior decision.

## The design tension, and how it was resolved

`src/components/ui/EmptyState.tsx` originally carried an explicit code comment documenting the approved Classical spec: *"Texto centralizado, opacidade reduzida, sem ilustração"* — centered text, reduced opacity, **no illustration**. Checkpoint 19.2's own Step 4 explicitly asks for a "Luxury illustration" in every empty state.

Rather than pick one instruction and ignore the other, this checkpoint reconciles them: a literal hand-drawn illustration is a new visual technique this codebase has never used anywhere, and introducing one only for empty states would be inconsistent with every other surface's icon-based visual language (`KpiCard`, `PageHeader`, `ModuleInsightCard` all use a soft-circle icon chip, never illustrated art). The `icon` prop added to `EmptyState` renders exactly that same icon-chip language — just larger (56px) and circular — which satisfies "no longer plain, reduced-opacity text alone" without introducing a new, unproven visual technique or contradicting the original "no illustration" intent (an icon-in-a-circle is not an illustration).

## The updated component

```tsx
<EmptyState
  icon={LeadsIcon}
  title="No leads yet"
  description="Your next unforgettable event starts here — create your first Lead."
  action={<Link href="/leads/new"><Button>New Lead</Button></Link>}
  secondaryAction={<a href="...">Learn how Leads work</a>}
/>
```

- `icon` — optional; a component from `src/components/ui/icons.tsx`, the same module's own nav icon by convention (e.g. `LeadsIcon` for Leads, `ClientsIcon` for Clients).
- `secondaryAction` — optional; Step 4's "Secondary Help" — a quieter link/text below the primary CTA. Available on the primitive; not every module has a genuine secondary help link to offer, so it's used only where one exists.
- `title`/`description`/`action` — unchanged from Checkpoint 19.1.

The whole card also now animates in with `animate-fade-up`.

## Copy

Where a module's empty state was touched in this checkpoint, its copy became specific to what's actually missing rather than generic ("No data"):

| Module | Before | After |
|---|---|---|
| Leads | "New leads you add will show up here." | "Your next unforgettable event starts here — create your first Lead." |

Other modules kept their existing (already specific, non-generic) empty-state copy from Checkpoint 19.1 and only gained the icon + animation.

## Known limitations

- Not every one of the ~100 pages in the app got a bespoke icon assignment — this was applied to the modules explicitly migrated in this checkpoint's own scope (the same set that received `PageHeader`/`KpiCard` treatment in 19.1/19.2). Any other page's `EmptyState` still renders correctly (the `icon` prop is optional), just without the icon badge.
