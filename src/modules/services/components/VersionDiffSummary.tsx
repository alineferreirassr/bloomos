import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import type { ServiceVersion } from "@/types/serviceVersion";

interface VersionDiffSummaryProps {
  version: ServiceVersion;
}

/**
 * Renders exactly the one thing the domain actually persists about "what
 * changed" — `change_summary`, the free-text note captured at publish time.
 * There is no stored field-by-field diff anywhere in the schema, so nothing
 * here computes one; a genuine side-by-side comparison is a real future
 * feature, not something to fake from what's available today. The
 * "Compare versions" action is a deliberate placeholder — disabled, with a
 * Tooltip explaining why — so the extension point exists without
 * pretending the feature is built.
 */
export function VersionDiffSummary({ version }: VersionDiffSummaryProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-[17px] font-semibold text-text">Change summary</h3>
        <Tooltip content="Side-by-side version comparison is coming in a future checkpoint.">
          <Button type="button" variant="secondary" aria-disabled="true" onClick={(event) => event.preventDefault()} className="cursor-not-allowed opacity-45">
            Compare versions
          </Button>
        </Tooltip>
      </div>
      {version.change_summary ? (
        <p className="mt-2 text-sm text-text">{version.change_summary}</p>
      ) : (
        <p className="mt-2 text-sm text-text-muted">
          {version.status === "draft" ? "This draft hasn't been published yet — no change summary exists." : "No change summary was recorded for this version."}
        </p>
      )}
    </Card>
  );
}
