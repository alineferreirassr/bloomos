# Capability Requirement Model

v2.0 Checkpoint 26.1, Steps 1-2, 15. `types/capability.ts`'s `CapabilityRequirement` and `lib/data/mock/capabilityRequirementsStore.ts`'s Registry.

## Every field defaults to "no constraint," not "matches nobody"

Every list field defaults to `[]`, every scalar to `null`. A brand-new requirement with everything empty matches every active worker — the correct, honest default. A requirement is never accidentally impossible to satisfy because a field was left unset.

## Contexts

```ts
const CAPABILITY_CONTEXT_TYPES = ["event", "client", "project_placeholder", "assignment", "asset", "equipment", "vehicle", "vendor", "team", "workspace", "custom"] as const;
```

`project_placeholder`, `assignment`, and `custom` have no real `KnowledgeNodeType` anywhere in this codebase — same "don't fabricate a node type" discipline `types/objectives.ts`'s `OBJECTIVE_SCOPES_WITH_NO_NODE` established. Requirements with these context types always have `context: null` and are identified purely by their own `id`/`title`. The other eight map to real Knowledge Graph nodes via `CAPABILITY_CONTEXT_TYPE_TO_NODE_TYPE`.

## Hard vs. soft, named explicitly

| Hard (blocks eligibility) | Soft (only affects ranking) |
|---|---|
| `required_skills` | `preferred_skills` |
| `required_certifications` | `preferred_certifications` |
| `required_languages` | `preferred_languages` |
| `minimum_experience_level` | `preferred_experience_level` |
| `required_equipment_types` | `preferred_equipment_types` |
| `required_vehicle_types` | `preferred_vehicle_types` |
| `required_availability_statuses` | — |
| `required_employment_types` | — |
| `required_team_id` | `preferred_team_id` |
| `excluded_worker_ids` / `excluded_team_ids` | — |
| `maximum_distance_km` / `location_requirement` | — |
| `custom_rules` | — |

`preferred_team_id` and `preferred_experience_level` are small, disclosed additions: the spec's Step 5 preference list names "Preferred Team" and "Preferred Experience Level," but Step 1's field list only defined the hard versions (`required_team_id`, `minimum_experience_level`). Rather than overload the hard fields with dual meaning, the soft counterparts got their own fields.

## Custom Deterministic Rules — a closed DSL, never arbitrary code

```ts
interface CapabilityCustomRule {
  id: string;
  field: "worker_role" | "employment_type" | "team_id" | "experience_level" | "worker_status";
  operator: "equals" | "not_equals" | "in" | "not_in";
  value: string | string[];
  description: string;
}
```

Every rule compares one named `Worker` field against a literal value — there is no `eval`, no expression parser, and no way to reference anything outside this fixed field list. This is what "Custom Deterministic Rules" honestly means: deterministic by construction, not by convention.

## Two fields with an honest scope limitation

- **`physical_requirements: string[]`** — freeform descriptive strings (e.g. "must be able to lift 50lbs"). This checkpoint has no verification mechanism for these; they're surfaced for human review only and never gate eligibility. Never silently enforced as if they were checked.
- **`required_valid_through_date: string | null`** — implements Step 12's "must remain valid through a future work date." See [`certification-capabilities.md`](certification-capabilities.md).

## Registry operations (Step 15)

`CapabilityRequirementsRepository`: `listRequirementsForWorkspace` (filters: `includeArchived`, `contextType`, `requiredSkill`, `requiredCertification`, `teamId`), `getRequirementById`, `createRequirement`, `updateRequirement`, `archiveRequirement`, `duplicateRequirement` (copies every field, appends " (Copy)" to the title, assigns a fresh id). Same `let`-array + `resetXStore()` mock convention every store in this checkpoint series uses — no Supabase table exists yet.
