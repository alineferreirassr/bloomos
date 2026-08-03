# Package Builder & Add-on Engine (Proposal Platform)

`lib/data/mock/proposalPackagesStore.ts`, `lib/data/mock/proposalAddonsStore.ts`. Named `proposal-package-builder.md` rather than `package-builder.md` to avoid colliding with the existing Execution Package Platform doc of that name (Checkpoint 27.3) — a completely unrelated "package" concept (a booking-time Proposal package here vs. a field-execution bundle there).

## Package Builder — 7 system packages, seeded

`luxury_picnic`, `beach_proposal`, `birthday`, `hotel_decoration`, `photography`, `ugc_campaign`, `digital_package` ship pre-seeded — the exact 7 the spec names (`custom_package` is the reserved 8th key for workspace-created packages). Each carries `name`, `description`, `category`, `basePrice_minor`, `currency`, and `includedAddonIds` (add-ons bundled in by default).

## Add-on Engine — 10 system add-ons, seeded

`flowers`, `champagne`, `drone`, `photography`, `videography`, `luxury_basket`, `live_music`, `candles`, `transportation_placeholder`, `custom_decor` — the exact 10 the spec names. `transportation_placeholder` is the spec's own named placeholder: it carries a flat quoted price with no routing, distance, or logistics calculation behind it, disclosed rather than fabricated.

## System vs. custom, identical to Templates

Both libraries follow the exact same discipline as [`proposal-templates.md`](proposal-templates.md): system entries (`isCustom: false`) cannot be archived; `createCustomPackage`/`createCustomAddon` let a workspace add its own, gated on `proposal_packages.manage`/`proposal_addons.manage` respectively.

## Where they're consumed

The Pricing Engine ([`pricing-engine.md`](pricing-engine.md)) prices selected packages/add-ons by reading their real `basePrice_minor`/`price_minor` at build time — never a second, independently-maintained price. The Knowledge Graph ([`proposal-platform.md`](proposal-platform.md)) gives both libraries real node identity (`proposal_package`/`proposal_addon`) specifically so `proposal_contains_package`/`proposal_contains_addon` can be real edges.
