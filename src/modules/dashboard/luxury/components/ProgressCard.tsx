import { createElement } from "react";
import { resolveLuxuryIcon } from "@/modules/dashboard/luxury/resolveLuxuryIcon";

export interface ProgressStageData {
  id: string;
  label: string;
  icon: string;
  complete: boolean;
}

/** Checkpoint 19, Step 7 — the Team Dashboard's "Event Progress" card: an overall percentage bar plus a row of stage icons, each checked off as it completes — matches the approved Team reference image's Planning/Design/Logistics/Setup/Execution/Cleanup row. */
export function ProgressCard({ percent, stages }: { percent: number; stages: ProgressStageData[] }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-luxury-small font-medium text-luxury-text-muted">Overall progress</p>
        <p className="font-luxury-display text-lg font-semibold text-luxury-text">{percent}%</p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-luxury-full bg-luxury-blush" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-luxury-full bg-luxury-rose transition-[width] duration-[var(--luxury-duration-gentle-ms)]" style={{ width: `${percent}%` }} />
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-y-3 sm:grid-cols-6">
        {stages.map((stage) => {
          const iconElement = createElement(resolveLuxuryIcon(stage.icon), { className: "h-4 w-4", "aria-hidden": true });
          return (
            <li key={stage.id} className="flex flex-col items-center gap-1.5 text-center">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ${stage.complete ? "bg-luxury-rose text-luxury-rose-foreground" : "bg-luxury-blush text-luxury-blush-foreground"}`}>
                {iconElement}
              </span>
              <span className="text-[11px] text-luxury-text-muted">{stage.label}</span>
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${stage.complete ? "bg-luxury-success" : "bg-luxury-border"}`} />
              <span className="sr-only">{stage.complete ? "Complete" : "Not yet complete"}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
