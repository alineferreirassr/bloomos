export const TIMES_OF_DAY = ["morning", "afternoon", "evening"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** Before noon → morning, before 6pm → afternoon, otherwise evening — the same three-way split every calendar/greeting convention uses. Takes a `Date` (not just an hour) so tests can pass a fixed instant. */
export function resolveTimeOfDay(now: Date = new Date()): TimeOfDay {
  const hour = now.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The one place the "Good {timeOfDay}, {firstName}" string is assembled — shared by `buildWelcomeCopy`'s own server-side pass and by any client-side re-greet that needs to correct `timeOfDay` for the visitor's local clock without re-deriving the format. */
export function buildTimeOfDayGreeting(firstName: string, timeOfDay: TimeOfDay = resolveTimeOfDay()): string {
  return `Good ${timeOfDay}, ${firstName}`;
}

export interface WelcomeCopy {
  greeting: string;
  subtitle: string;
}

export type WelcomeCopyInput =
  | { experience: "owner"; firstName: string; timeOfDay?: TimeOfDay; workspaceName: string }
  | { experience: "team"; firstName: string; timeOfDay?: TimeOfDay; taskCount: number; eventCount: number }
  | { experience: "client"; firstName: string; subjectLabel: string };

/**
 * Checkpoint 19, Step 5 — the one shared welcome-copy builder every
 * dashboard experience calls, rather than each hand-rolling its own
 * greeting string. Owner and Team get a time-of-day greeting ("Good
 * morning, {name}"); Client gets a plain "Welcome, {name}" — matching the
 * three approved reference images exactly (the Client image never reads
 * "Good morning," only "Welcome"). No name is ever hardcoded here — every
 * input is a parameter; `Aline`/`Sophia`/`Michael` exist only in this
 * checkpoint's own test fixtures and browser-verification data.
 */
export function buildWelcomeCopy(input: WelcomeCopyInput): WelcomeCopy {
  if (input.experience === "client") {
    return {
      greeting: `Welcome, ${input.firstName}`,
      subtitle: `Here's everything about your ${input.subjectLabel}. We've got it all under control.`,
    };
  }

  const timeOfDay = input.timeOfDay ?? resolveTimeOfDay();
  const greeting = buildTimeOfDayGreeting(input.firstName, timeOfDay);

  if (input.experience === "owner") {
    return { greeting, subtitle: `Here's what's happening across ${input.workspaceName} today.` };
  }

  const taskPart = pluralize(input.taskCount, "task");
  const eventPart = pluralize(input.eventCount, "event");
  return { greeting, subtitle: `Here's your plan for today. You've got ${taskPart} and ${eventPart}.` };
}
