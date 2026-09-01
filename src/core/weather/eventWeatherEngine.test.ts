import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/services/weather", () => ({
  getDailyForecastForDate: vi.fn(),
  getHourlyForecastNear: vi.fn(),
}));

import { getEventWeather } from "@/core/weather/eventWeatherEngine";
import { getDailyForecastForDate, getHourlyForecastNear } from "@/services/weather";
import type { DailyForecast, WeatherSnapshot } from "@/types/weather";

const mockGetDailyForecastForDate = vi.mocked(getDailyForecastForDate);
const mockGetHourlyForecastNear = vi.mocked(getHourlyForecastNear);

const DAY: DailyForecast = {
  date: "2026-08-22",
  condition: "SUNNY",
  weatherCode: 0,
  highF: 78,
  lowF: 62,
  precipitationProbabilityMax: 5,
  windSpeedMaxMph: 8,
  sunrise: "2026-08-22T06:15:00",
  sunset: "2026-08-22T19:31:00",
};

const HOUR: WeatherSnapshot = {
  time: "2026-08-22T18:30:00",
  condition: "NIGHT_CLEAR",
  weatherCode: 1,
  temperatureF: 69,
  precipitationProbability: 5,
  windSpeedMph: 8,
  windDirectionDeg: 210,
  isDay: false,
};

describe("getEventWeather", () => {
  beforeEach(() => {
    mockGetDailyForecastForDate.mockReset();
    mockGetHourlyForecastNear.mockReset();
  });

  it("reports MISSING_COORDINATES without calling the weather service at all", async () => {
    const result = await getEventWeather({ latitude: null, longitude: null, timezone: null, event_date: "2026-08-22", start_time: "18:30" });
    expect(result).toEqual({ success: false, error: { reason: "MISSING_COORDINATES", message: "Location needed for weather" } });
    expect(mockGetDailyForecastForDate).not.toHaveBeenCalled();
  });

  it("reports MISSING_EVENT_DATE when coordinates exist but event_date doesn't", async () => {
    const result = await getEventWeather({ latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles", event_date: null, start_time: "18:30" });
    expect(result).toEqual({ success: false, error: { reason: "MISSING_EVENT_DATE", message: "Event date needed for weather" } });
    expect(mockGetDailyForecastForDate).not.toHaveBeenCalled();
  });

  it("falls back to 'auto' timezone when the event has no timezone field, never server-local time", async () => {
    mockGetDailyForecastForDate.mockResolvedValue({ success: true, data: DAY });
    mockGetHourlyForecastNear.mockResolvedValue({ success: true, data: HOUR });

    await getEventWeather({ latitude: 34.05, longitude: -118.24, timezone: null, event_date: "2026-08-22", start_time: "18:30" });

    expect(mockGetDailyForecastForDate).toHaveBeenCalledWith({ latitude: 34.05, longitude: -118.24, timezone: "auto" }, "2026-08-22");
  });

  it("uses the event's own real timezone when present", async () => {
    mockGetDailyForecastForDate.mockResolvedValue({ success: true, data: DAY });
    mockGetHourlyForecastNear.mockResolvedValue({ success: true, data: HOUR });

    await getEventWeather({ latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles", event_date: "2026-08-22", start_time: "18:30" });

    expect(mockGetDailyForecastForDate).toHaveBeenCalledWith({ latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles" }, "2026-08-22");
  });

  it("combines event_date + start_time into the target lookup and returns both eventTime and day", async () => {
    mockGetDailyForecastForDate.mockResolvedValue({ success: true, data: DAY });
    mockGetHourlyForecastNear.mockResolvedValue({ success: true, data: HOUR });

    const result = await getEventWeather({ latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles", event_date: "2026-08-22", start_time: "18:30" });

    expect(mockGetHourlyForecastNear).toHaveBeenCalledWith({ latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles" }, "2026-08-22T18:30:00");
    expect(result).toEqual({ success: true, data: { point: { latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles" }, eventTime: HOUR, day: DAY, sunset: DAY.sunset } });
  });

  it("never fabricates eventTime when start_time is null — falls back to day alone without calling the hourly lookup", async () => {
    mockGetDailyForecastForDate.mockResolvedValue({ success: true, data: DAY });

    const result = await getEventWeather({ latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles", event_date: "2026-08-22", start_time: null });

    expect(mockGetHourlyForecastNear).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: { point: { latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles" }, eventTime: null, day: DAY, sunset: DAY.sunset } });
  });

  it("still returns the day summary when the hourly lookup itself fails (e.g. FORECAST_OUT_OF_RANGE) rather than failing the whole request", async () => {
    mockGetDailyForecastForDate.mockResolvedValue({ success: true, data: DAY });
    mockGetHourlyForecastNear.mockResolvedValue({ success: false, error: { reason: "FORECAST_OUT_OF_RANGE", message: "Forecast not available yet" } });

    const result = await getEventWeather({ latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles", event_date: "2026-08-22", start_time: "18:30" });

    expect(result).toEqual({ success: true, data: { point: { latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles" }, eventTime: null, day: DAY, sunset: DAY.sunset } });
  });

  it("propagates a day-lookup failure (e.g. FORECAST_OUT_OF_RANGE for an event too far out) as the whole result's error", async () => {
    mockGetDailyForecastForDate.mockResolvedValue({ success: false, error: { reason: "FORECAST_OUT_OF_RANGE", message: "Forecast not available yet" } });

    const result = await getEventWeather({ latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles", event_date: "2027-01-01", start_time: "18:30" });

    expect(result).toEqual({ success: false, error: { reason: "FORECAST_OUT_OF_RANGE", message: "Forecast not available yet" } });
  });
});
