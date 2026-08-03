# Reporting Permissions

7 permissions added to `core/enums/permission.ts`'s `PERMISSIONS` list, each gating a distinct capability rather than one blanket `reports.access`:

| Permission | Gates |
|---|---|
| `reports.view` | The Reporting Center itself: report library, report detail/preview |
| `reports.manage` | Save/update/archive/restore a report |
| `reports.build` | The Report Builder — composing a new report from registered metrics |
| `reports.snapshots` | Generating a snapshot |
| `reports.financial` | A narrower gate on report sections/templates that surface financial metrics — a member can have `reports.view` without seeing revenue/invoice numbers |
| `reports.executive` | Executive-category templates/sections and `getExecutiveReportInsightsAction()` — mirrors the access boundary already enforced on the Objectives pages those metrics wrap |
| `reports.client_safe` | Reserved, currently unused server-side — Client-Safe Reporting is instead gated entirely by `ClientAccountContext` (a Client Portal session), never by staff permissions, since it's a different actor class entirely |

## Enforcement points

- `requireReportsPermission()` (`modules/reporting/reportingActions.ts`) — every module action checks the caller's permission before touching the store or the Computation Engine.
- The 3-gate visibility contract (`core/reporting/discovery.ts`) — per-metric, checks `requiredPermissions` alongside role and feature-flag visibility, identical in shape to `core/analytics/discovery.ts`.
- `reportingHealthEngine.ts`'s `permission_configuration` category — flags any financial or executive metric that was registered *without* a non-empty `requiredPermissions`, catching a misconfiguration class before it ships.

## Why `reports.client_safe` exists but is unused server-side

It's declared for completeness and future use (e.g. if a staff-facing "preview what a client sees" mode is ever built), but `clientSafeReportActions.ts` intentionally does not check it — Client Portal sessions are a separate authentication boundary (`getCurrentClientAccountContext()`), and gating client-safe data behind a *staff* permission would be the wrong boundary for data a client is supposed to see about their own account.
