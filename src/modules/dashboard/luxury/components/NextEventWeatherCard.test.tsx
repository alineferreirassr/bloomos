import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextEventWeatherCard } from "@/modules/dashboard/luxury/components/NextEventWeatherCard";
import type { NextEventWeather } from "@/modules/dashboard/luxury/getOwnerDashboardData";

function nextEventWeather(overrides: Partial<NextEventWeather> = {}): NextEventWeather {
  return {
    eventId: "event_1",
    title: "Amelia & Noah Wedding",
    dateLabel: "Sep 13",
    timeLabel: "5:00 PM",
    forecast: {
      point: { latitude: 34.05, longitude: -118.24, timezone: "America/Los_Angeles" },
      eventTime: { time: "2026-09-13T17:00:00", condition: "SUNNY", weatherCode: 0, temperatureF: 78, precipitationProbability: 5, windSpeedMph: 4, windDirectionDeg: 180, isDay: true },
      day: { date: "2026-09-13", condition: "SUNNY", weatherCode: 0, highF: 82, lowF: 61, precipitationProbabilityMax: 5, windSpeedMaxMph: 6, sunrise: "2026-09-13T06:30:00", sunset: "2026-09-13T19:15:00" },
      sunset: "2026-09-13T19:15:00",
      ...overrides.forecast,
    },
    ...overrides,
  };
}

describe("NextEventWeatherCard — no upcoming event (never vanishes)", () => {
  it("renders a graceful empty state, not nothing, when there is no eligible upcoming event", () => {
    render(<NextEventWeatherCard data={null} />);

    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("No upcoming event with a set location yet — weather appears here once one is scheduled.")).toBeInTheDocument();
  });

  it("still shows a founder-authored contingency plan even with no live forecast eligible", () => {
    render(<NextEventWeatherCard data={null} contingencyNote="Tent has a full rain backup plan." />);

    expect(screen.getByText("Tent has a full rain backup plan.")).toBeInTheDocument();
  });
});

describe("NextEventWeatherCard — forecast unavailable for an otherwise-eligible event", () => {
  it("renders a named unavailable message rather than nothing when neither eventTime nor day resolved", () => {
    const data = nextEventWeather({ forecast: { point: { latitude: 1, longitude: 1, timezone: "UTC" }, eventTime: null, day: null, sunset: null } });

    render(<NextEventWeatherCard data={data} />);

    expect(screen.getByText("Weather unavailable for Amelia & Noah Wedding.")).toBeInTheDocument();
  });
});

describe("NextEventWeatherCard — real forecast data only, never fabricated", () => {
  it("renders the event-time snapshot's real temperature, condition text, and high/low from the same real forecast", () => {
    render(<NextEventWeatherCard data={nextEventWeather()} />);

    expect(screen.getByText("78°")).toBeInTheDocument();
    expect(screen.getAllByText("Sunny").length).toBeGreaterThan(0);
    expect(screen.getByText("H 82° · L 61°")).toBeInTheDocument();
    expect(screen.getByText(/Sep 13/)).toBeInTheDocument();
    expect(screen.getByText(/5:00 PM/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Amelia & Noah Wedding" })).toHaveAttribute("href", "/events/event_1");
  });

  it("falls back to the day summary's high as the headline temperature when the event has no start_time to pin an hourly snapshot to", () => {
    const data = nextEventWeather({
      timeLabel: null,
      forecast: {
        point: { latitude: 1, longitude: 1, timezone: "UTC" },
        eventTime: null,
        day: { date: "2026-09-13", condition: "PARTLY_CLOUDY", weatherCode: 2, highF: 70, lowF: 55, precipitationProbabilityMax: 10, windSpeedMaxMph: 5, sunrise: "x", sunset: "x" },
        sunset: null,
      },
    });

    render(<NextEventWeatherCard data={data} />);

    expect(screen.getByText("70°")).toBeInTheDocument();
    expect(screen.getAllByText("Partly Cloudy").length).toBeGreaterThan(0);
    expect(screen.getByText("H 70° · L 55°")).toBeInTheDocument();
    expect(screen.getByText("Sep 13")).toBeInTheDocument();
  });

  it("shows a real precipitation percentage only when data provides it, never a fabricated figure", () => {
    render(<NextEventWeatherCard data={nextEventWeather()} />);
    expect(screen.getByText("5%")).toBeInTheDocument();
  });

  it("shows real wind speed (rounded) from the actual forecast data, never a fabricated value", () => {
    render(<NextEventWeatherCard data={nextEventWeather()} />);
    // eventTime.windSpeedMph is 4 in the fixture.
    expect(screen.getByText("4 mph")).toBeInTheDocument();
  });
});

describe("NextEventWeatherCard — operational note is derived, never a fixed unrelated string", () => {
  it("shows a rain-review note for rain conditions", () => {
    const data = nextEventWeather({
      forecast: {
        point: { latitude: 1, longitude: 1, timezone: "UTC" },
        eventTime: { time: "x", condition: "RAIN", weatherCode: 61, temperatureF: 60, precipitationProbability: 70, windSpeedMph: 5, windDirectionDeg: null, isDay: true },
        day: null,
        sunset: null,
      },
    });

    render(<NextEventWeatherCard data={data} />);

    expect(screen.getByText("Rain possible — review outdoor setups.")).toBeInTheDocument();
  });

  it("shows a clear-conditions note for sunny conditions", () => {
    render(<NextEventWeatherCard data={nextEventWeather()} />);
    expect(screen.getByText("Clear conditions for outdoor setups.")).toBeInTheDocument();
  });

  it("omits the operational note entirely for a plain, low-signal condition rather than inventing one", () => {
    const data = nextEventWeather({
      forecast: {
        point: { latitude: 1, longitude: 1, timezone: "UTC" },
        eventTime: { time: "x", condition: "CLOUDY", weatherCode: 3, temperatureF: 65, precipitationProbability: 10, windSpeedMph: 5, windDirectionDeg: null, isDay: true },
        day: null,
        sunset: null,
      },
    });

    render(<NextEventWeatherCard data={data} />);

    expect(screen.queryByText(/review outdoor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Clear conditions/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Snow expected/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reduced visibility/)).not.toBeInTheDocument();
  });
});

describe("NextEventWeatherCard — Team's contingency plan note (shared component, Team-only prop)", () => {
  it("renders the founder-authored contingency note alongside a real live forecast, clearly separated from it", () => {
    render(<NextEventWeatherCard data={nextEventWeather()} contingencyNote="Tent has a full rain backup plan." />);

    expect(screen.getByText("78°")).toBeInTheDocument();
    expect(screen.getByText("Contingency plan:")).toBeInTheDocument();
    expect(screen.getByText(/Tent has a full rain backup plan\./)).toBeInTheDocument();
  });

  it("does not render a contingency plan line at all when none was authored", () => {
    render(<NextEventWeatherCard data={nextEventWeather()} />);
    expect(screen.queryByText("Contingency plan:")).not.toBeInTheDocument();
  });
});
