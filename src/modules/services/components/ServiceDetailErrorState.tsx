import { ErrorState } from "@/components/ui/ErrorState";
import type { ServiceHookError } from "@/modules/services/hooks/errorContract";

const MISSING_DRAFT_VERSION_PATTERN = /has no draft version/;

interface ServiceDetailErrorStateProps {
  error: ServiceHookError;
  onRetry?: () => void;
}

/**
 * Never collapses every failure into one generic message — `kind` drives
 * the copy, and the one real domain invariant this screen can hit (a
 * Service missing its always-required draft version — see
 * `getServiceEditor`) gets its own distinct message instead of falling into
 * the generic "unexpected" bucket it's technically classified under.
 */
export function ServiceDetailErrorState({ error, onRetry }: ServiceDetailErrorStateProps) {
  if (error.kind === "not_found") {
    return <ErrorState message="This Service doesn't exist, or has been permanently removed." />;
  }
  if (error.kind === "unauthorized" || error.kind === "forbidden") {
    return <ErrorState message="You don't have access to view this Service." />;
  }
  if (error.kind === "unexpected" && MISSING_DRAFT_VERSION_PATTERN.test(error.message)) {
    return <ErrorState message="This Service is missing its draft version, which every Service is expected to always have. This is a data integrity issue — contact support." />;
  }
  return <ErrorState message="We couldn't load this Service." onRetry={onRetry} />;
}
