import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { SchedulingFinding, SchedulingFindingSeverity, Calendar, Appointment } from "@/types/scheduling";

/**
 * v2.0 Checkpoint 27, Step 16 — Executive Integration. Translates
 * `SchedulingFinding[]` into the Executive Decision Platform's own
 * `OperationalRecommendation` shape — the same "translate, don't
 * duplicate" discipline `capabilityFindingsEngine.ts` established.
 * This file detects nothing; every recommendation traces back to a
 * finding `schedulingRiskEngine.ts` already computed.
 */
const SEVERITY_MAP: Record<SchedulingFindingSeverity, RecommendationSeverity> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

/** Prefers the related appointment's own context node, then the related calendar's, and finally falls back to the workspace itself — never a fabricated node. */
function resolveFindingNode(finding: SchedulingFinding, calendarById: Map<string, Calendar>, appointmentById: Map<string, Appointment>, workspaceId: string): KnowledgeNodeRef {
  if (finding.relatedAppointmentId !== null) {
    const appointment = appointmentById.get(finding.relatedAppointmentId);
    if (appointment?.context) return appointment.context;
  }
  if (finding.relatedCalendarId !== null) {
    const calendar = calendarById.get(finding.relatedCalendarId);
    if (calendar?.context) return calendar.context;
  }
  return { nodeType: "workspace", nodeId: workspaceId };
}

export function schedulingFindingsToRecommendations(findings: SchedulingFinding[], calendars: Calendar[], appointments: Appointment[], workspaceId: string): OperationalRecommendation[] {
  const calendarById = new Map(calendars.map((c) => [c.id, c] as const));
  const appointmentById = new Map(appointments.map((a) => [a.id, a] as const));
  return findings.map((finding) => ({
    ruleId: `scheduling.${finding.type}`,
    message: finding.description,
    severity: SEVERITY_MAP[finding.severity],
    node: resolveFindingNode(finding, calendarById, appointmentById, workspaceId),
  }));
}
