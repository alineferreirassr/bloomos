# core/

Shared system concerns used across all modules.

- **`enums/`, `errors/`, `constants/`** — populated (Leads module needs canonical status/category/priority enums, typed errors, and the shared Workspace/actor constants).
- **`workflows/`** — populated. `leadWorkflow.ts` is the single source of truth for the Lead lifecycle (allowed statuses, allowed transitions, `canTransition`/`getNextStatuses`/`isTerminalStatus`), consumed by both the data layer and the UI so neither encodes its own copy of the rule.
- **`permissions/`, `guards/`** — populated (Team Portal phase). `permissions/routeAccess.ts` is the single source of truth for what a route requires; `guards/memberAccess.ts` turns a session + that requirement into an allow/deny decision.
- **`roles/`, `logger/`** — still placeholders. Populated once there's a real need for a dedicated roles module (today's roles live in `enums/workspaceRole.ts` + `permissions/`) or structured logging.

## Core domain (module-foundation, "Core" phase)

The architectural foundation every future business module (Inventory, Vendors, Bloom AI, and beyond) plugs into, rather than reinventing. `index.ts` is the umbrella barrel; each concern below also has its own front-door `index.ts` for direct import.

| Concern | Front door | Status |
|---|---|---|
| Notes | `core/notes` | Generalizes the pre-existing polymorphic Notes system (`types/note.ts` + `lib/data/mock/notesTimelineShared.ts`) — adds the one missing shared piece (`togglePinNoteById`) and a Supabase-side equivalent (`lib/data/core/notesTimelineSupabaseShared.ts`). Existing modules are not migrated onto this front door this phase. |
| Timeline | `core/timeline` | Same generalization as Notes, plus `activityTypeRegistry.ts` — lets a future module register its own activity type + label without editing `enums/timelineActivityType.ts`. |
| Files / Attachments | `core/files` | Re-exports `MediaAsset` — the Shared Media Library already IS the generic, provider-agnostic attachment system; no second type was created. |
| Tags | `core/tags` | New, mock-only. Any `EntityType` is taggable via `owner_type`/`owner_id`. |
| Comments | `core/comments` | New, mock-only. Short-form remarks on any entity, one level of reply threading, soft-deleted. |
| Notifications | `core/notifications` | New. `in_app` has a real mock repository; `email`/`sms`/`push` are provider interfaces only (`NotificationProvider` + `registerNotificationProvider`) — no delivery vendor integrated. |
| Audit Log | `core/audit` | New, mock-only, append-only by construction — the repository interface has no update/delete method. Distinct from Timeline: field-level before/after, not a user-facing description. |
| Search | `core/search` | Registry only — `registerSearchableEntity`/`getSearchableEntities` record which `EntityType`s are searchable; `nullSearchProvider` satisfies the `SearchProvider` interface with zero indexing. `defaultRegistrations.ts` registers Leads/Clients/Events/Documents/Invoices/Payments/Expenses (live) and Inventory/Vendors (reserved, no route yet). |
| AI | `core/ai` | Interfaces only — `AIProvider`, `AIConversation`, `AIPrompt`, `AIContext`, `AICompletion`. No model integration; see `docs/ai.md` for the vision/guardrails these types encode (`AICompletion.requiresApproval` is "assist, not replace" at the type level). |
| Shared Types | `core/types/shared.ts` | `OwnerRef`, `Paginated<T>`, and a re-export of `DataResult`/`ok`/`fail`. |

Every new mock repository above follows the same pattern as every business module: an interface in `lib/data/core/<concern>/repository.ts`, a `mockRepository.ts` implementing it, workspace-scoped by an explicit `workspaceId` parameter (never a global constant). None has a Supabase implementation or migration yet — deferred until a consuming feature actually needs persistence past a page reload, per this phase's explicit scope.
