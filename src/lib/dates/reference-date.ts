import { isoDateInTimeZone, isValidIsoDate, type IsoDate } from "./date-only";

/** Time zone used for all calendar-date decisions in the Slovenian demo. */
export const DEMO_TIME_ZONE = "Europe/Ljubljana";

/**
 * Single source of "today" for the demonstration dataset.
 *
 * Every fictional date in the demo is expressed relative to this reference
 * date, so the demonstration stays meaningful after deployment: an activity
 * that is "overdue by 15 days" stays overdue by 15 days regardless of when
 * the page is viewed.
 *
 * `DEMO_REFERENCE_DATE` (YYYY-MM-DD) can pin the date for screenshots or
 * reproducible tests. It is optional and has no effect on stored data.
 */
export function getDemoReferenceDate(now: Date = new Date()): IsoDate {
  const pinned = process.env.DEMO_REFERENCE_DATE;
  if (pinned && isValidIsoDate(pinned)) return pinned;
  return isoDateInTimeZone(now, DEMO_TIME_ZONE);
}
