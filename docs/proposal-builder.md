# Proposal Builder

`types/proposalPlatform.ts` (block/section types), `core/proposalPlatform/proposalBuilderEngine.ts`, `modules/proposalPlatform/components/ProposalDetailView.tsx`'s "New Version" panel.

## 15 named block types

`heading`, `paragraph`, `image`, `gallery`, `pricing_table`, `package_table`, `timeline`, `faq`, `callout`, `divider`, `feature_grid`, `video_placeholder`, `button_placeholder`, `signature_placeholder`, `custom` — the exact 15 the spec names.

Every block is one flexible shape (`ProposalBlock`) rather than 15 near-identical interfaces: `heading`/`text` cover the text-bearing types, `mediaAssetIds` covers image/gallery, `items: ProposalBlockListItem[]` covers FAQ/feature-grid/timeline rows, `packageIds` covers the package table, `tone` covers the callout, and `placeholderLabel` covers the 3 named placeholder types.

`pricing_table`/`package_table` blocks carry **no independent content** — they mark "render the live Pricing Engine output here" / "render these selected packages here," pulling from the document's own `packageIds` and computed `ProposalPricing` rather than storing a second copy that could drift.

The 3 placeholder types (`video_placeholder`/`button_placeholder`/`signature_placeholder`) render a labeled visual slot only — the stop condition forbids real video embeds, real outbound links, and real e-signatures this checkpoint.

## Not Canva — a compact, deterministic form

Step 3 explicitly forbids depending on Canva. The Builder here is a purposefully compact form embedded in the Journey Detail page (Step 19): select a Template (auto-fills header/hero/section-keys from the Template Library), check Packages/Add-ons (auto-resolves their real prices from the library), set a deposit percentage, write Terms/Policies — then **Create Version** assembles a real `CreateProposalVersionInput` and submits it through the exact same `assembleSnapshot`/`buildProposalVersion` pipeline the engine's own test suite exercises. It is not a drag-and-drop canvas, but every field flows through the same tested engine path a richer UI would use.

## Assembly — `assembleSnapshot`

`core/proposalPlatform/proposalBuilderEngine.ts`'s `assembleSnapshot(input: CreateProposalVersionInput): ProposalSnapshot` is the one place a builder submission becomes a frozen snapshot: it computes `pricing` fresh via the Pricing Engine (never accepts a stale, caller-supplied total) and copies every other field by value.

## Reuse

Sections are populated from the Section Library (`PROPOSAL_SECTION_LABELS`, [`proposal-templates.md`](proposal-templates.md)); pricing lines are populated from the Package/Package Builder libraries ([`package-builder.md`](package-builder.md)) and priced by the [Pricing Engine](pricing-engine.md) — the Builder itself never invents a price or a section name.
