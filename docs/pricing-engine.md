# Pricing Engine

`core/proposalPlatform/pricingEngine.ts`.

## Pure arithmetic, no provider

`computeProposalPricing(input: ProposalPricingInput): ProposalPricing` is a pure function over already-selected packages/add-ons/optional-services — it never calls a payment provider, a tax service, or a coupon validator. The spec's own Step 5 surfaces:

| Field | Source |
|---|---|
| Base Price | `input.basePrice_minor`, a flat starting figure |
| Packages | lines with `kind: "package"`, summed into `packagesSubtotal_minor` |
| Add-ons | lines with `kind: "addon"`, summed into `addonsSubtotal_minor` |
| Optional Services | any line with `isOptional: true` — excluded from `subtotal_minor`/`grandTotal_minor`, tracked separately in `optionalServicesTotal_minor` |
| Discounts | `input.discount` — `percentage` or `fixed`, capped so it never exceeds the subtotal |
| Coupons | `input.couponCode` — a plain carried string only, **never validated against a real coupon provider** |
| Taxes | `input.taxRatePercent` — a flat `subtotal * rate` calculation, **never a real jurisdiction-aware tax service** |
| Deposit | `input.depositPercent` of the grand total → `depositDue_minor` |
| Remaining Balance | `grandTotal_minor - depositDue_minor` |
| Subtotal / Grand Total | `subtotal_minor` (before discount/tax), `grandTotal_minor` (after) |

## Coupons and Taxes — disclosed placeholders

The spec's own Step 5 names "Coupons Placeholder" and "Taxes Placeholder" explicitly. `couponCode` carries whatever string a user enters with zero validation; `taxRatePercent`, when set, applies a flat percentage with no jurisdiction, product-category, or exemption logic — a deliberately honest placeholder, not a fabricated tax engine.

## Rounding

Every intermediate figure (`lineTotal_minor`, `discountAmount_minor`, `taxAmount_minor`, `depositDue_minor`) rounds to the nearest minor unit via `Math.round` — no fractional cents ever leak into the totals.

## Tested

11 tests cover single/multi-line sums, package-vs-addon subtotal separation, optional-line exclusion, percentage and fixed discounts (including the subtotal cap), flat tax, deposit/remaining-balance math, a zero-line empty case, and quantity multiplication.
