# core/

Shared system concerns used across all modules.

- **`enums/`, `errors/`, `constants/`** — populated (Leads module needs canonical status/category/priority enums, typed errors, and the shared Workspace/actor constants).
- **`workflows/`** — populated. `leadWorkflow.ts` is the single source of truth for the Lead lifecycle (allowed statuses, allowed transitions, `canTransition`/`getNextStatuses`/`isTerminalStatus`), consumed by both the data layer and the UI so neither encodes its own copy of the rule.
- **`permissions/`, `roles/`, `guards/`, `logger/`** — still placeholders. Populated once authentication exists and there's a real session/role to check.
