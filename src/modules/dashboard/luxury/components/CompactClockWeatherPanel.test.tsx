import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompactClockWeatherPanel } from "@/modules/dashboard/luxury/components/CompactClockWeatherPanel";
import { DEFAULT_OPERATIONAL_LOCATION } from "@/core/dashboard/operationalLocation";
import type { DailyForecast } from "@/types/weather";

afterEach(() => {
  vi.useRealTimers();
});

const forecast: DailyForecast = {
  date: "2026-08-29",
  condition: "PARTLY_CLOUDY",
  weatherCode: 2,
  highF: 78,
  lowF: 60,
  precipitationProbabilityMax: 10,
  windSpeedMaxMph: 7,
  sunrise: "x",
  sunset: "x",
};

describe("CompactClockWeatherPanel — Team + Client compact variant", () => {
  it("renders exactly one clock for the default California operational location, with a real computed time", () => {
    vi.setSystemTime(new Date("2026-08-29T05:24:00Z")); // matches WorldClockCard's own Huntington Beach worked example: 10:24 PM

    render(<CompactClockWeatherPanel location={DEFAULT_OPERATIONAL_LOCATION} forecast={forecast} />);

    // "Huntington Beach" appears twice by design: once as the clock's own city label, once as the Weather header's location tag — never a second clock.
    expect(screen.getAllByText("Huntington Beach")).toHaveLength(2);
    expect(screen.getByText("California, United States")).toBeInTheDocument();
    expect(screen.getByText("10:24 PM")).toBeInTheDocument();
    expect(screen.getByText("Night")).toBeInTheDocument();
    // Never the Founder Dashboard's multi-city framing on this compact variant.
    expect(screen.queryByText("Honolulu")).not.toBeInTheDocument();
    expect(screen.queryByText("Sorocaba")).not.toBeInTheDocument();
    expect(screen.queryByText(/from Honolulu/)).not.toBeInTheDocument();
  });

  it("renders the real forecast for the same location", () => {
    render(<CompactClockWeatherPanel location={DEFAULT_OPERATIONAL_LOCATION} forecast={forecast} />);

    expect(screen.getByText("78°")).toBeInTheDocument();
    // The "·" separator is its own <span>, so the H/L line is split across text nodes — match by normalized textContent instead of an exact string.
    expect(screen.getByText((_, element) => element?.tagName === "P" && (element.textContent?.replace(/\s+/g, " ").trim() ?? "") === "H 78° · L 60°")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByText("7 mph")).toBeInTheDocument();
  });

  it("shows a graceful, honest message when the forecast is unavailable — never a fabricated value", () => {
    render(<CompactClockWeatherPanel location={DEFAULT_OPERATIONAL_LOCATION} forecast={null} />);

    expect(screen.getByText("Weather is unavailable for Huntington Beach right now.")).toBeInTheDocument();
  });
});
