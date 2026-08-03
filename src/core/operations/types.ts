/**
 * v2 Checkpoint 21 — shared types for the Event Operations Platform's
 * reusable engines (HealthScoreEngine, RiskEngine, PackingEngine,
 * LogisticsEngine, BudgetEngine, TimelineEngine, EventOperationsEngine).
 * Every engine is a pure function over already-fetched data — none of them
 * perform I/O themselves, matching `eventHealth.ts`/`financialSummary.ts`'s
 * own precedent so each stays independently unit-testable.
 */

export const OPERATIONS_HEALTH_BANDS = ["excellent", "good", "attention", "critical"] as const;
export type OperationsHealthBand = (typeof OPERATIONS_HEALTH_BANDS)[number];

export const OPERATIONS_HEALTH_BAND_LABELS: Record<OperationsHealthBand, string> = {
  excellent: "Excellent",
  good: "Good",
  attention: "Attention",
  critical: "Critical",
};

export interface OperationsHealthFactor {
  label: string;
  deduction: number;
  /** Which operational area this factor came from — lets the UI group "why" by domain rather than a flat list. */
  domain: "checklist" | "financial" | "inventory" | "vendors" | "team" | "purchases" | "timeline" | "documents" | "budget" | "logistics";
}

export const RISK_KINDS = [
  "missing_team",
  "late_vendor",
  "low_inventory",
  "pending_payment",
  "missing_contract",
  "budget_overrun",
  "late_purchase",
  "missing_checklist",
] as const;
export type RiskKind = (typeof RISK_KINDS)[number];

export const RISK_SEVERITIES = ["warning", "critical"] as const;
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

export interface OperationsRisk {
  kind: RiskKind;
  severity: RiskSeverity;
  message: string;
  recommendation: string;
}

export const PACKING_CATEGORIES = [
  "decoration",
  "flowers",
  "candles",
  "balloons",
  "furniture",
  "tools",
  "extension_cords",
  "lighting",
  "vehicle",
  "safety",
  "other",
] as const;
export type PackingCategory = (typeof PACKING_CATEGORIES)[number];

export const PACKING_CATEGORY_LABELS: Record<PackingCategory, string> = {
  decoration: "Decoration",
  flowers: "Flowers",
  candles: "Candles",
  balloons: "Balloons",
  furniture: "Furniture",
  tools: "Tools",
  extension_cords: "Extension Cords",
  lighting: "Lighting",
  vehicle: "Vehicle Requirements",
  safety: "Safety Items",
  other: "Other",
};

export interface PackingListItem {
  itemName: string;
  quantity: number;
  category: PackingCategory;
  /** Whether real stock is already matched (pull from inventory) vs. needs sourcing (shopping list). */
  source: "inventory" | "shopping";
  inventoryItemId: string | null;
}

export const LOGISTICS_PHASES = ["arrival", "setup", "ceremony", "photography", "cleanup", "departure"] as const;
export type LogisticsPhase = (typeof LOGISTICS_PHASES)[number];

export const LOGISTICS_PHASE_LABELS: Record<LogisticsPhase, string> = {
  arrival: "Arrival",
  setup: "Setup",
  ceremony: "Ceremony",
  photography: "Photography",
  cleanup: "Cleanup",
  departure: "Departure",
};

export interface LogisticsPhaseEntry {
  phase: LogisticsPhase;
  time: string | null;
  title: string;
  scheduleItemId: string;
}

export interface LogisticsBuffer {
  /** Minutes between the end of one phase item and the start of the next — null when either side has no time. */
  minutes: number | null;
  fromTitle: string;
  toTitle: string;
}

export interface LogisticsPlan {
  phases: LogisticsPhaseEntry[];
  travelBuffers: LogisticsBuffer[];
  loadingNote: string;
  unloadingNote: string;
}

export interface OperationsBudget {
  estimatedRevenueMinor: number;
  estimatedCostMinor: number;
  actualRevenueMinor: number;
  actualCostMinor: number;
  profitMinor: number;
  marginPercentage: number;
  forecastVarianceMinor: number;
  forecastNote: string;
}

export const OPERATIONS_TIMELINE_MILESTONE_KINDS = [
  "proposal_created",
  "deposit_paid",
  "flowers_ordered",
  "inventory_reserved",
  "vendor_assigned",
  "team_assigned",
  "setup_started",
  "client_arrived",
  "event_completed",
  "gallery_delivered",
  "review_received",
  "other",
] as const;
export type OperationsTimelineMilestoneKind = (typeof OPERATIONS_TIMELINE_MILESTONE_KINDS)[number];

export interface OperationsTimelineEntry {
  id: string;
  kind: OperationsTimelineMilestoneKind;
  title: string;
  description: string | null;
  occurredAt: string;
}
