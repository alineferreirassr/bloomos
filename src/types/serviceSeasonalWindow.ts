/** A month range this Service is typically available in (e.g. May–September for an outdoor Service) — feeds future Reporting seasonality analytics and the AI risk engine ("booked outside its usual season"). Multiple non-contiguous windows are modeled as multiple rows rather than a single wrapping range. */
export interface ServiceSeasonalWindow {
  id: string;
  workspace_id: string;
  service_version_id: string;
  /** 1 (January) through 12 (December). */
  start_month: number;
  end_month: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}
