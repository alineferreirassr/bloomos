import type { ServiceCategory } from "@/types/serviceCategory";
import type { Service } from "@/types/service";
import type { ServiceVersion } from "@/types/serviceVersion";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CURRENT_ACTOR } from "@/core/constants/actor";

/**
 * The catalog-identity layer: ServiceCategory, Service, ServiceVersion. Two
 * seeded Services (Photography, Luxury Picnic), each with one "published"
 * v1 (what event_services in eventServicesStore.ts actually pins to) and
 * one "draft" clone ready for continued editing — mirrors exactly what
 * publishServiceVersion produces in real use. See serviceTemplatesStore.ts
 * for each version's template rows and eventServicesStore.ts for the
 * Instance layer this catalog generates into.
 */
const SEED_SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "service_category_photography",
    workspace_id: CURRENT_WORKSPACE_ID,
    name: "Photography",
    description: "Photo and video coverage services.",
    display_order: 0,
    created_at: "2026-07-10T09:00:00.000Z",
    updated_at: "2026-07-10T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "service_category_experiences",
    workspace_id: CURRENT_WORKSPACE_ID,
    name: "Experiences",
    description: "Curated proposal and celebration experiences.",
    display_order: 1,
    created_at: "2026-07-10T09:00:00.000Z",
    updated_at: "2026-07-10T09:00:00.000Z",
    archived_at: null,
  },
];

const SEED_SERVICES: Service[] = [
  {
    id: "service_photography",
    workspace_id: CURRENT_WORKSPACE_ID,
    category_id: "service_category_photography",
    name: "Photography",
    description: "On-site photography coverage for the proposal or event.",
    status: "active",
    draft_version_id: "service_version_photography_draft",
    current_published_version_id: "service_version_photography_v1",
    created_at: "2026-07-10T09:00:00.000Z",
    updated_at: "2026-07-12T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "service_luxury_picnic",
    workspace_id: CURRENT_WORKSPACE_ID,
    category_id: "service_category_experiences",
    name: "Luxury Picnic",
    description: "A fully styled picnic setup for a proposal or celebration.",
    status: "active",
    draft_version_id: "service_version_picnic_draft",
    current_published_version_id: "service_version_picnic_v1",
    created_at: "2026-07-10T09:00:00.000Z",
    updated_at: "2026-07-12T09:00:00.000Z",
    archived_at: null,
  },
];

const SEED_SERVICE_VERSIONS: ServiceVersion[] = [
  {
    id: "service_version_photography_v1",
    service_id: "service_photography",
    workspace_id: CURRENT_WORKSPACE_ID,
    version_number: 1,
    status: "published",
    name_snapshot: "Photography",
    description_snapshot: "On-site photography coverage for the proposal or event.",
    base_price_minor: 150000,
    currency: "USD",
    setup_duration_minutes: 30,
    breakdown_duration_minutes: 15,
    difficulty_score: 3,
    experience_level_required: "intermediate",
    weather_sensitivity: "medium",
    surprise_friendly: false,
    estimated_profit_minor: 60000,
    change_summary: "Initial release.",
    published_at: "2026-07-12T09:00:00.000Z",
    published_by: CURRENT_ACTOR,
    created_at: "2026-07-10T09:00:00.000Z",
    updated_at: "2026-07-12T09:00:00.000Z",
  },
  {
    id: "service_version_photography_draft",
    service_id: "service_photography",
    workspace_id: CURRENT_WORKSPACE_ID,
    version_number: null,
    status: "draft",
    name_snapshot: null,
    description_snapshot: null,
    base_price_minor: 150000,
    currency: "USD",
    setup_duration_minutes: 30,
    breakdown_duration_minutes: 15,
    difficulty_score: 3,
    experience_level_required: "intermediate",
    weather_sensitivity: "medium",
    surprise_friendly: false,
    estimated_profit_minor: 60000,
    change_summary: null,
    published_at: null,
    published_by: null,
    created_at: "2026-07-12T09:00:00.000Z",
    updated_at: "2026-07-12T09:00:00.000Z",
  },
  {
    id: "service_version_picnic_v1",
    service_id: "service_luxury_picnic",
    workspace_id: CURRENT_WORKSPACE_ID,
    version_number: 1,
    status: "published",
    name_snapshot: "Luxury Picnic",
    description_snapshot: "A fully styled picnic setup for a proposal or celebration.",
    base_price_minor: 85000,
    currency: "USD",
    setup_duration_minutes: 45,
    breakdown_duration_minutes: 30,
    difficulty_score: 2,
    experience_level_required: "beginner",
    weather_sensitivity: "high",
    surprise_friendly: true,
    estimated_profit_minor: 35000,
    change_summary: "Initial release.",
    published_at: "2026-07-12T09:00:00.000Z",
    published_by: CURRENT_ACTOR,
    created_at: "2026-07-10T09:00:00.000Z",
    updated_at: "2026-07-12T09:00:00.000Z",
  },
  {
    id: "service_version_picnic_draft",
    service_id: "service_luxury_picnic",
    workspace_id: CURRENT_WORKSPACE_ID,
    version_number: null,
    status: "draft",
    name_snapshot: null,
    description_snapshot: null,
    base_price_minor: 85000,
    currency: "USD",
    setup_duration_minutes: 45,
    breakdown_duration_minutes: 30,
    difficulty_score: 2,
    experience_level_required: "beginner",
    weather_sensitivity: "high",
    surprise_friendly: true,
    estimated_profit_minor: 35000,
    change_summary: null,
    published_at: null,
    published_by: null,
    created_at: "2026-07-12T09:00:00.000Z",
    updated_at: "2026-07-12T09:00:00.000Z",
  },
];

let serviceCategories: ServiceCategory[] = SEED_SERVICE_CATEGORIES.map((c) => ({ ...c }));
let services: Service[] = SEED_SERVICES.map((s) => ({ ...s }));
let serviceVersions: ServiceVersion[] = SEED_SERVICE_VERSIONS.map((v) => ({ ...v }));

export function readServiceCategories(): ServiceCategory[] {
  return serviceCategories;
}
export function writeServiceCategories(next: ServiceCategory[]): void {
  serviceCategories = next;
}

export function readServices(): Service[] {
  return services;
}
export function writeServices(next: Service[]): void {
  services = next;
}

export function readServiceVersions(): ServiceVersion[] {
  return serviceVersions;
}
export function writeServiceVersions(next: ServiceVersion[]): void {
  serviceVersions = next;
}

/** Test-only: restore every catalog store to its seeded state between test cases. */
export function resetServicesStore(): void {
  serviceCategories = SEED_SERVICE_CATEGORIES.map((c) => ({ ...c }));
  services = SEED_SERVICES.map((s) => ({ ...s }));
  serviceVersions = SEED_SERVICE_VERSIONS.map((v) => ({ ...v }));
}
