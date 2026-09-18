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
/**
 * VISUAL-01 — the Owner Home header's own small-caps eyebrow date, e.g.
 * "FRIDAY, SEPTEMBER 18". Always derived from a real `Date` (defaults to
 * `new Date()`, never a hardcoded string) — the exact same "take a `Date`,
 * default to now" shape `resolveTimeOfDay` already uses, so a test can
 * pass a fixed instant. Uppercased by the caller's own CSS (`uppercase`
 * utility), not here — this returns plain Title Case so the raw string is
 * still readable in a snapshot/test failure.
 */
export function formatStudioDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/**
 * VISUAL-01 — the Owner Home header's calm contextual sentence, directly
 * beneath the greeting. Deliberately the smallest truthful presentation:
 * reuses `priorities`/`notificationCount`, both already computed by
 * `getOwnerDashboardData.ts` for other, pre-existing surfaces (Today's
 * Priority, the notification bell) — no new urgency/intelligence engine,
 * no AI, no fabricated status. "Everything is calm" is only ever returned
 * when both real counts are genuinely zero; otherwise a plain, factual
 * count-based sentence, never a vague "some things need you."
 */
export function buildCalmContextualSentence(priorityCount: number, notificationCount: number): string {
  if (priorityCount === 0 && notificationCount === 0) {
    return "Everything is calm. Nothing needs you right now.";
  }
  const parts: string[] = [];
  if (priorityCount > 0) parts.push(pluralize(priorityCount, "priority", "priorities"));
  if (notificationCount > 0) parts.push(pluralize(notificationCount, "notification"));
  return `You have ${parts.join(" and ")} waiting for you today.`;
}

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
