import type { IsoDate } from "./date-only";

/**
 * Time-of-day values (appointments, notification times) use the
 * Europe/Ljubljana time zone. They are stored as UTC timestamps and
 * converted with these helpers.
 *
 * Daylight-saving rules for wall-clock input (e.g. an appointment entered as
 * "2026-10-25 02:30"):
 *   - a time that does not exist (spring forward gap) is rejected (null);
 *   - an ambiguous time (autumn fall back) resolves to its FIRST occurrence
 *     (summer time).
 */

export const APP_TIME_ZONE = "Europe/Ljubljana";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const displayFormatter = new Intl.DateTimeFormat("sl-SI", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export interface LocalParts {
  date: IsoDate;
  time: string; // HH:mm
}

export function toLjubljanaParts(instant: Date): LocalParts {
  const parts = partsFormatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Converts Ljubljana wall-clock date and time to a UTC instant (see DST rules above). */
export function ljubljanaWallTimeToUtc(date: IsoDate, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const naiveUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  // Ljubljana is UTC+2 in summer and UTC+1 in winter. Earlier instant first.
  const candidates = [naiveUtc - 2 * 3_600_000, naiveUtc - 3_600_000]
    .map((ms) => new Date(ms))
    .filter((instant) => {
      const local = toLjubljanaParts(instant);
      return local.date === date && local.time === time;
    });
  return candidates[0] ?? null;
}

export function formatDateTime(value: string | Date): string {
  const instant = typeof value === "string" ? new Date(value) : value;
  return displayFormatter.format(instant);
}

/** Calendar date (YYYY-MM-DD) of an instant in Ljubljana. */
export function ljubljanaDate(instant: Date = new Date()): IsoDate {
  return toLjubljanaParts(instant).date;
}

/** "12. 11. 2026 09:00–11:00", or both full date-times when the range spans days (Ljubljana time). */
export function formatDateTimeRange(starts: string, ends: string): string {
  const a = toLjubljanaParts(new Date(starts));
  const b = toLjubljanaParts(new Date(ends));
  return a.date === b.date
    ? `${formatDateTime(starts)}–${b.time}`
    : `${formatDateTime(starts)} – ${formatDateTime(ends)}`;
}
