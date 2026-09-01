import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/services/weather/openMeteoClient", async () => {
  const actual = await vi.importActual<typeof import("@/services/weather/openMeteoClient")>("@/services/weather/openMeteoClient");
  return { ...actual, fetchOpenMeteoForecast: vi.fn() };
});

import { fetchOpenMeteoForecast, OpenMeteoRequestError, type OpenMeteoForecastResponse } from "@/services/weather/openMeteoClient";
import { getCurrentWeather, getDailyForecast, getDailyForecastForDate, getHourlyForecast, getHourlyForecastNear } from "@/services/weather/weatherService";

const mockFetch = vi.mocked(fetchOpenMeteoForecast);

function response(overrides: Partial<OpenMeteoForecastResponse> = {}): OpenMeteoForecastResponse {
  return {
    timezone: "America/Los_Angeles",
    current: { time: "2026-08-22T14:00", temperature_2m: 72, weather_code: 1, wind_speed_10m: 5, wind_direction_10m: 200, is_day: 1 },
    hourly: {
      time: ["2026-08-22T18:00", "2026-08-22T19:00"],
      temperature_2m: [70, 68],
      weather_code: [1, 0],
      precipitation_probability: [5, 5],
      wind_speed_10m: [6, 25],
      wind_direction_10m: [200, 200],
      is_day: [1, 0],
    },
    daily: {
      time: ["2026-08-22"],
      weather_code: [1],
      temperature_2m_max: [78],
      temperature_2m_min: [62],
      precipitation_probability_max: [5],
      wind_speed_10m_max: [8],
      sunrise: ["2026-08-22T06:15"],
      sunset: ["2026-08-22T19:31"],
    },
    ...overrides,
  };
}

const POINT = { latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles" };

beforeEach(() => {
  mockFetch.mockReset();
});

describe("getCurrentWeather", () => {
  it("returns MISSING_COORDINATES without calling fetch for a non-finite point", async () => {
    const result = await getCurrentWeather({ latitude: NaN, longitude: -118.24, timezone: "auto" });
    expect(result).toEqual({ success: false, error: { reason: "MISSING_COORDINATES", message: "Location needed for weather" } });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("classifies using Open-Meteo's own is_day flag rather than device/server time", async () => {
    mockFetch.mockResolvedValue(response());
    const result = await getCurrentWeather(POINT);
    expect(result).toEqual({
      success: true,
      data: { time: "2026-08-22T14:00", condition: "SUNNY", weatherCode: 1, temperatureF: 72, precipitationProbability: null, windSpeedMph: 5, windDirectionDeg: 200, isDay: true },
    });
  });

  it("wraps a provider error as PROVIDER_ERROR rather than throwing", async () => {
    mockFetch.mockRejectedValue(new OpenMeteoRequestError(500, "boom"));
    const result = await getCurrentWeather(POINT);
    expect(result).toEqual({ success: false, error: { reason: "PROVIDER_ERROR", message: "Weather provider error" } });
  });

  it("wraps an unexpected error as UNAVAILABLE", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    const result = await getCurrentWeather(POINT);
    expect(result).toEqual({ success: false, error: { reason: "UNAVAILABLE", message: "Weather unavailable" } });
  });
});

describe("getHourlyForecast (windy + night/clear through the full pipeline)", () => {
  it("classifies each hourly point using its own is_day and applies the WINDY override only where wind crosses the threshold", async () => {
    mockFetch.mockResolvedValue(response());
    const result = await getHourlyForecast(POINT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // Hour 0: code 1 (clear), day, wind 6mph — below threshold, stays SUNNY.
    expect(result.data[0].condition).toBe("SUNNY");
    // Hour 1: code 0 (clear), night, wind 25mph — above threshold, WINDY overrides NIGHT_CLEAR.
    expect(result.data[1].condition).toBe("WINDY");
  });
});

describe("getDailyForecastForDate", () => {
  it("returns FORECAST_OUT_OF_RANGE for a date outside the returned daily series", async () => {
    mockFetch.mockResolvedValue(response());
    const result = await getDailyForecastForDate(POINT, "2027-01-01");
    expect(result).toEqual({ success: false, error: { reason: "FORECAST_OUT_OF_RANGE", message: "Forecast not available yet" } });
  });

  it("returns the matching day when present", async () => {
    mockFetch.mockResolvedValue(response());
    const result = await getDailyForecastForDate(POINT, "2026-08-22");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.date).toBe("2026-08-22");
  });
});

describe("getHourlyForecastNear", () => {
  it("finds the nearest hourly point to a target local datetime", async () => {
    mockFetch.mockResolvedValue(response());
    const result = await getHourlyForecastNear(POINT, "2026-08-22T18:15:00");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.time).toBe("2026-08-22T18:00");
  });

  it("returns FORECAST_OUT_OF_RANGE when the nearest point is more than 36 hours away", async () => {
    mockFetch.mockResolvedValue(response());
    const result = await getHourlyForecastNear(POINT, "2026-09-22T18:15:00");
    expect(result).toEqual({ success: false, error: { reason: "FORECAST_OUT_OF_RANGE", message: "Forecast not available yet" } });
  });
});

describe("getDailyForecast", () => {
  it("returns UNAVAILABLE when the provider response has no daily block", async () => {
    mockFetch.mockResolvedValue(response({ daily: undefined }));
    const result = await getDailyForecast(POINT);
    expect(result).toEqual({ success: false, error: { reason: "UNAVAILABLE", message: "Weather unavailable" } });
  });
});
