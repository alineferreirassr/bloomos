# Business Health Score (v2 Checkpoint 23, Step 10)

`src/core/analytics/businessHealthEngine.ts`'s `computeBusinessHealthScore()` unifies 9 weighted dimensions into one 0–100 score and one of 4 bands (Excellent / Healthy / Attention / Critical), following the exact "deduction-based, pure function over pre-aggregated facts" shape `core/operations/healthScoreEngine.ts` (Checkpoint 21) already established for per-event health. It never fetches data itself — the module layer (`getExecutiveDashboardData.ts`) does the fetching/aggregation and hands in a plain `BusinessHealthContext`.

## The 9 dimensions and their weights

| Dimension | Weight | What it measures |
|---|---|---|
| Finance | 0.18 | Overdue receivables ratio, net profit margin (only when there's revenue to measure a margin against), cash flow direction |
| Operations | 0.13 | `operations/healthScoreEngine.ts`'s own average per-event health score across active events (reused, never recomputed), plus overdue checklist items |
| Events | 0.12 | Share of active events currently at Attention/Critical health |
| CRM | 0.11 | Lead-to-client conversion rate (only when there are leads) and its trend |
| Payments | 0.11 | Failed payments and overdue invoices |
| Risk | 0.10 | Open critical/warning risks from Checkpoint 21's Risk Center |
| Team | 0.09 | Share of team-assigned checklist items overdue |
| Inventory | 0.08 | Share of inventory low in stock |
| Customer Satisfaction | 0.08 | Always `null` — see below |
| **Total** | **1.00** | |

## Every score is explained

Each dimension carries an `explanation` string and a `factors` array (`{label, impact}`) alongside its numeric score — the spec's own "Explain every score" requirement. The Executive Dashboard's Business Health card and the PDF executive summary both render these `factors` directly rather than a bare number, so "why is the score 62" always has a concrete, itemized answer: `"18% of receivables are overdue"`, `"2 open critical risks"`, and so on.

## Continuous deductions, not tiers — a real bug this caught

The first draft of every dimension used a small number of capped tiers (e.g., "overdue ratio > 50% → -20, otherwise 0"). A test asserting that a maximally bad workspace bands as `critical` failed — it landed at `attention` (score 54), because capped tiers meant even the worst possible input per dimension couldn't push the weighted average low enough. Every deduction was rewritten to be continuous and proportional to the actual severity (e.g., `Math.round(overdueReceivablesRatio * 50)`, not a fixed -20 once a threshold is crossed) — verified afterward by recomputing the worst-case floor, which now reaches the low single digits, safely inside `critical`.

## "No data" is never scored as "bad data" — two real bugs

Two more bugs surfaced from the same root cause and were fixed the same way, by adding an explicit "do we have any data at all" flag to the context and skipping the deduction entirely when it's false:

- **CRM**: a brand-new workspace with zero leads was scored as "0% conversion" and penalized. Fixed by adding `leadCount` to the context — the conversion deduction now only applies when `leadCount > 0`.
- **Finance**: a period with zero revenue was scored as "thin margin" (0% is technically under the 10% threshold). Fixed by adding `hasRevenueThisPeriod: boolean` — the margin deduction now only applies when there's actual revenue to measure.

Both bugs were caught by this checkpoint's own test suite before being fixed, not observed in production — but they're documented here because the underlying principle (a metric with zero denominator is missing data, not a failing score) governs every dimension in this engine and should guide any dimension added to it later.

## Customer Satisfaction always scores `null`

No CSAT/review data source exists anywhere in BloomOS today. Rather than approximate one from a proxy (event health, repeat-booking rate), this dimension's `score` is always `null`, and its 8% weight is proportionally redistributed across the 8 dimensions that do have real data — `computeBusinessHealthScore` filters out `null`-scored dimensions before weighting, so the remaining weights are renormalized to sum to 1.0 rather than silently averaging in a fabricated value. This is the same "no fake KPIs" discipline the Goals panel and Client Intelligence panel apply elsewhere in this checkpoint.

## Bands

Reuses `BUSINESS_HEALTH_BANDS`/`businessHealthBandFromScore()` (`src/types/businessIntelligence.ts`):

```
score >= 85  → Excellent
score >= 65  → Healthy
score >= 40  → Attention
score <  40  → Critical
```

## Where it's displayed

- **Executive Dashboard** — a dedicated Business Health widget with the band badge and per-dimension explanation list.
- **PDF Executive Summary export** — a full section listing every dimension's score and its factors.
- **Bloom AI Executive Insights** — not directly narrated (the insights engine's 7 categories are separate from the 9 health dimensions), but both read from the same underlying facts (payments, risk, operations) so the two surfaces never contradict each other.
