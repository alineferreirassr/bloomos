import { LEAD_SOURCES } from "@/modules/leads/constants";

/** A Client's source is usually inherited from the originating Lead — same curated set. */
export const CLIENT_SOURCES = LEAD_SOURCES;

/** No canonical enum was specified for relationship_status — kept as a free string in
 *  the data model, with this as the curated set of options the form offers. */
export const RELATIONSHIP_STATUS_OPTIONS = ["Dating", "Engaged", "Married", "Partnered", "Other"];
