import { Card } from "@/components/ui/Card";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";

interface AssignmentTeamCardProps {
  team: EventServiceTeamRequirement[];
}

export function AssignmentTeamCard({ team }: AssignmentTeamCardProps) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Assigned team</h3>
      {team.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No team roles required for this assignment.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {team.map((requirement) => (
            <li key={requirement.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
              <span className="text-text">
                {requirement.role_label} × {requirement.quantity}
              </span>
              <span className={requirement.assigned_member_id ? "text-text" : "text-text-muted"}>{requirement.assigned_member_id ? "Assigned" : "Unassigned"}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
