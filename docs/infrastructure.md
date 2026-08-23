# BloomOS Infrastructure

Source of truth for BloomOS's environment topology, provisioning state, infrastructure blockers, and Founder infrastructure decisions. It is **not** the source of truth for application architecture, product features, roadmap, actionable TODOs, or shipped-code history — see §7 for the boundary with the rest of the documentation system.

**System separation:** BloomOS belongs to **Amoré Bloom**. AF Digital Studio OS belongs to **AF Digital Studio**. These are separate products with separate Supabase organizations. Never merge or conflate their organizations, projects, or infrastructure state.

**Secret-handling rule:** this file may record organization display names, organization IDs, project names, project refs, regions, secret-free URLs, provider names, plan tier, and lifecycle state. It must **never** contain database passwords, API keys, anon keys treated as credentials, service-role keys, Supabase access tokens, OAuth client secrets, webhook signing secrets, Stripe secrets, passwords, MFA/OTP codes, or any other credential or payment detail.

## 1. Systems & Ownership

| System | Belongs to | Supabase organization |
|---|---|---|
| BloomOS | Amoré Bloom | `Amoré Bloom` (`kpmqibljdavizcxscmdj`) |
| AF Digital Studio OS | AF Digital Studio | `AF Digital Studio` (`cdlwjbqoepqkjypdfhxx`) |

AF Digital Studio's projects are unrelated to BloomOS and must never be created, paused, transferred, or deleted as a side effect of BloomOS infrastructure work:

| Project | Ref | Status |
|---|---|---|
| `af-digital-studio-os` | `cktmzkrpptdjennfvpsu` | ACTIVE_HEALTHY |
| `AF Group os` | `bkynniicdhulrvtiisiu` | INACTIVE |

## 2. Environments

### Development

| Field | Value |
|---|---|
| SYSTEM | BloomOS |
| PROVIDER | Supabase |
| ORGANIZATION | Amoré Bloom |
| ORGANIZATION_ID | `kpmqibljdavizcxscmdj` |
| PROJECT | `bloomos-development` |
| PROJECT_REF | `udknkbmprwdcwxttcyoz` |
| REGION | `ca-central-1` |
| PLAN | Free |
| STATUS | PROVISIONED / ACTIVE |
| LAST_VERIFIED | 2026-08-22 |
| DATABASE_BOOTSTRAP_STATUS | Pre-existing environment — its database already existed before the current provisioning sequence; no fresh 159-migration bootstrap has been applied here |
| DEPLOYMENT_STATUS | Not deployed — no hosting target configured |
| DOMAIN_STATUS | None |
| INTEGRATIONS | GitHub: absent · Log drains: absent |
| MIGRATION_BASELINE | 159 committed migrations constitute the authorized bootstrap set for new environments |
| EXCLUDED_MIGRATIONS | `20260815100000_employee_wellness_privacy.sql` — excluded from the current Staging/Production bootstrap authorization, outside the current Finance rollout scope |

### Staging

| Field | Value |
|---|---|
| SYSTEM | BloomOS |
| PROVIDER | Supabase |
| ORGANIZATION | Amoré Bloom |
| ORGANIZATION_ID | `kpmqibljdavizcxscmdj` |
| INTENDED_PROJECT | `bloomos-staging` |
| INTENDED_REGION | `us-west-2` |
| STATUS | BLOCKED / NOT PROVISIONED |
| PROJECT_REF | N/A — project was not created |
| CREATION_ATTEMPTED | Yes, exactly once |
| CREATION_RESULT | Blocked |
| CURRENT_BLOCKER | `SUPABASE_FREE_ACTIVE_PROJECT_LIMIT` — Supabase permits only 2 active Free projects across organizations where the Founder is owner/admin; the two active projects currently consuming those slots are `bloomos-development` and `af-digital-studio-os`. Zero-cost safe slot recovery was investigated; no safe candidate project was found. This is an external platform quota plus a Founder plan decision — not a code, migration, database, or repository defect. |

### Production

| Field | Value |
|---|---|
| SYSTEM | BloomOS |
| STATUS | NOT PROVISIONED |
| PROJECT | N/A |
| PROJECT_REF | N/A |
| CREATION_ATTEMPTED | No |
| PROVISIONING_AUTHORIZED | No |

## 3. Current Blockers

| Blocker | Environment | Since | Detail |
|---|---|---|---|
| `SUPABASE_FREE_ACTIVE_PROJECT_LIMIT` | Staging | F1.17B | See Staging row above. Resolvable only via a Founder-authorized Pro upgrade or project pause (§5). |

## 4. Founder Decisions

Append-only. A superseding decision adds a new dated entry referencing the one it supersedes — existing entries are never edited or removed.

- **2026-08-22** — BloomOS infrastructure belongs under the `Amoré Bloom` Supabase organization, separate from `AF Digital Studio`.
- **2026-08-22** — The existing `bloomos-development` project was transferred from `AF Digital Studio` to `Amoré Bloom` and preserved (ref, database, Auth, Storage, API keys intact) rather than recreated.
- **2026-08-22** — Staging target locked: name `bloomos-staging`, organization `Amoré Bloom`, region `us-west-2`.
- **2026-08-22** — Founder declined a Supabase Pro upgrade at this time.
- **2026-08-22** — Founder did not authorize pausing `bloomos-development`.
- **2026-08-22** — Founder did not authorize pausing `af-digital-studio-os`.
- **2026-08-22** — Zero-cost safe slot recovery was investigated and confirmed unavailable (no existing project is a safe pause candidate).
- **2026-08-22** — Production provisioning is not currently authorized.

## 5. Resume Conditions

The BloomOS infrastructure sequence may resume, after fresh verification, only if one of these occurs:

- **A.** Founder explicitly authorizes an `Amoré Bloom` Pro upgrade.
- **B.** Founder explicitly authorizes pausing an active project, following a fresh safety review.
- **C.** Supabase changes its Free active-project quota/rules such that `bloomos-staging` can be created without A or B.

None of these conditions are assumed to have occurred merely because time has passed — each requires fresh verification when invoked.

## 6. Infrastructure Checkpoint Status

| Checkpoint | Status |
|---|---|
| F1.17A — Staging Provisioning Preflight | COMPLETE |
| F1.17B — Organization reconciliation / Amoré Bloom creation / Development transfer | COMPLETE |
| F1.17B — Staging project creation | BLOCKED |
| F1.17B-CLOSE — Blocker record & sequence freeze | COMPLETE |
| F1.17C — Staging Bootstrap Pre-Apply Gate | FROZEN / NOT STARTED |
| F1.17D — Staging Database Bootstrap | FROZEN / NOT STARTED |
| F1.17E — Staging Database Verification | FROZEN / NOT STARTED |
| F1.18 — Staging Hosting/Deployment | FROZEN / NOT STARTED |
| F1.19 — Staging E2E Verification | FROZEN / NOT STARTED |
| Production sequence | NOT AUTHORIZED |

## 7. Governance & Update Rules

- **Update trigger:** this file is updated at the conclusion of any infrastructure/provisioning checkpoint that changes environment state, records a new Founder decision, or changes checkpoint status. It is not updated for routine application code changes.
- **Boundary with `CHANGELOG.md`:** CHANGELOG records shipped code changes; this file records environment/organization state. A Staging bootstrap, once it happens, may warrant a line in both — they answer different questions.
- **Boundary with `TODO.md`:** TODO is actionable product-work tracking; this file's §5 (Resume Conditions) is its infrastructure-scoped analogue, not a duplicate.
- **Boundary with `ROADMAP.md`:** ROADMAP is phased product delivery planning; this file is current infrastructure reality.
- **Boundary with `docs/v2-checkpoint-*.md`:** those certify shipped product features; this file has no per-feature content.
- **Boundary with `docs/integrations.md`:** that file covers integration *architecture and boundaries* (the mock/Supabase data-mode switch, third-party service design); this file covers environment *state* (which literal project/org backs each environment today).
- **Ownership:** maintained by whoever runs infrastructure/provisioning checkpoints, as part of that checkpoint's own final-report step.
