/** Metadata only — no authentication or permission enforcement exists yet; see docs/permissions.md for the planned Client Portal / Team Portal access model this will eventually drive. */
export const DOCUMENT_VISIBILITIES = ["internal", "client", "team", "client_and_team", "restricted"] as const;

export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

export const DOCUMENT_VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  internal: "Internal Only",
  client: "Client Visible",
  team: "Team Visible",
  client_and_team: "Client & Team Visible",
  restricted: "Restricted",
};
