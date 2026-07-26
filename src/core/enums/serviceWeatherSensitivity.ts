/** How exposed a ServiceVersion is to weather conditions — feeds the future Weather Intelligence module (roadmap Step 8) and today's service_conflict_rules (Phase 2c), e.g. "high" pairs naturally with a conflict rule against high wind or rain. */
export const SERVICE_WEATHER_SENSITIVITIES = ["none", "low", "medium", "high"] as const;

export type ServiceWeatherSensitivity = (typeof SERVICE_WEATHER_SENSITIVITIES)[number];

export const SERVICE_WEATHER_SENSITIVITY_LABELS: Record<ServiceWeatherSensitivity, string> = {
  none: "Not Weather Sensitive",
  low: "Low Sensitivity",
  medium: "Medium Sensitivity",
  high: "High Sensitivity",
};
