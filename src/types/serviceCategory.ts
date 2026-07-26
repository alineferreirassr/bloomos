/** A grouping for Services in the catalog (Photography, Catering, Entertainment, Decor...) — organizational only, no operational behavior of its own. */
export interface ServiceCategory {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
