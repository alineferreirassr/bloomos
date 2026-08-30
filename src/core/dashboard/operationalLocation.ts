/**
 * "Team + Client Compact Clock & Weather Variant" addendum — the ONE
 * shared "Amoré Bloom operational location" the Team page's and Client
 * portal's compact Clock+Weather panels both key off, as opposed to the
 * Founder Dashboard's editable multi-city `WORLD_CLOCK_LOCATIONS`. Not yet
 * editable: doing so needs a persisted workspace setting (a schema change)
 * plus a location-search/geocoding integration, neither of which exists
 * yet — see the checkpoint report's
 * `OPERATIONAL_LOCATION_PERSISTENCE_REQUIRES_SCHEMA_CHANGE`. Hard-coded
 * here, in ONE place, so wiring real persistence later only means
 * replacing this constant's source, not touching every call site.
 *
 * City/region/timezone intentionally match `WORLD_CLOCK_LOCATIONS`'s own
 * `"huntington-beach"` entry exactly, so Founder's World Clock and this
 * compact panel can never silently disagree about what time it is in the
 * same city.
 */
export interface OperationalLocation {
  city: string;
  region: string;
  timezone: string;
  latitude: number;
  longitude: number;
}

export const DEFAULT_OPERATIONAL_LOCATION: OperationalLocation = {
  city: "Huntington Beach",
  region: "California, United States",
  timezone: "America/Los_Angeles",
  latitude: 33.6603,
  longitude: -118.0068,
};

/**
 * "Staging Visual Correction" addendum — the Founder Dashboard's Weather
 * card fallback when no upcoming event carries real coordinates: real
 * current weather for Honolulu, the same city `WORLD_CLOCK_LOCATIONS`
 * already names as the Founder's own HOME base. Never shown instead of a
 * real upcoming event's weather — only when there isn't one.
 */
export const FOUNDER_HOME_LOCATION: OperationalLocation = {
  city: "Honolulu",
  region: "Hawaii, United States",
  timezone: "Pacific/Honolulu",
  latitude: 21.3099,
  longitude: -157.8581,
};
