# Client Journey State Resolver

`core/clientJourney/journeyStateResolver.ts`. Derives the current journey stage purely from facts already recorded by Leads/Clients/Proposals/Contracts/Invoices/Events/Client Portal — it never writes to any of them and never invents a fact those modules don't already carry.

## Algorithm

For every one of the 29 named stages, an independent evidence check runs against the source data (`lead`, `client`, `proposals`, `contracts`, `invoices`, `payments`, `events`, `clientAccounts`, `financialSummary`, `latestManualTransition`). The **highest-ranked stage whose evidence is satisfied wins** — this is a max-over-evidence resolution, not a sequential waterfall, so a journey that has already reached Contract Signed is never mistakenly reported as Proposal Sent just because that evidence also happens to still be true.

Lost/Cancelled short-circuit ahead of everything else: `Lead.status === "lost"`, the focus Event's own `status === "cancelled"`, or a recorded manual transition of that type.

## Two disclosed proxies

- **Proposal Sent** — `ProposalDraft` has no "sent"/"viewed" state in this codebase (confirmed by research: `ProposalStatus` is only `draft | accepted | rejected | superseded`). `reviewed_at` (set when a team member reviews/approves a draft) is used as the presented-to-client signal.
- **Discovery / Negotiation** (optional stages) — Discovery reads from `Lead.status === "consultation_scheduled"`; Negotiation reads from a proposal's own `parent_proposal_id` being set (a regenerated draft implies back-and-forth).

## The Welcome stage fix

An early version of this resolver treated "no Contract row exists yet" as equivalent to "no Contract is required," which let the resolver skip straight from Proposal Accepted to Welcome before Contract Preparation/Sent/Signed were ever evidenced. The fix (caught by this checkpoint's own test suite): Welcome now requires an *actual* signed Contract — `!!contract && contract.signature_status === "signed"` — never a merely-absent one. There is no domain flag distinguishing "not required" from "not created yet," so this resolver is deliberately conservative: it will never claim a stage is satisfied by the *absence* of a record.

## No fact past Closed

`follow_up`/`review_requested`/`review_received`/`rebooking_opportunity` have no source-module field at all — BloomOS has no review/testimonial module. These are reachable only through an explicit, recorded `JourneyTransitionRecord` (see [`journey-transitions.md`](journey-transitions.md)); the resolver never guesses its way past `closed` on its own. `reopened` transitions similarly move the resolved stage back to an earlier one only when explicitly recorded.
