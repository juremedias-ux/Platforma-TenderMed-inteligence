/**
 * Date-only arithmetic for service deadlines.
 *
 * Service deadlines, purchase dates and warranty end dates are calendar
 * dates without a time of day. They are stored as ISO strings
 * (`YYYY-MM-DD`) and calculated in UTC so that daylight-saving transitions
 * never shift a deadline by a day.
 *
 * Month-end policy: adding months clamps to the last valid day of the target
 * month (31 January + 1 month = 28 February, or 29 February in a leap year).
 * Recurring intervals are always calculated from the last recorded
 * completion date, never chained from a previously clamped due date, so a
 * clamped February date does not permanently shift later deadlines.
 */

/** Calendar date in ISO format, e.g. `2026-11-08`. */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

interface DateParts {
  year: number;
  month: number; // 1–12
  day: number;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function toParts(date: IsoDate): DateParts {
  if (!isValidIsoDate(date)) {
    throw new RangeError(`Invalid ISO date: ${date}`);
  }
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return { year, month, day };
}

function fromParts({ year, month, day }: DateParts): IsoDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toUtcMs(date: IsoDate): number {
  const { year, month, day } = toParts(date);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): IsoDate {
  const d = new Date(ms);
  return fromParts({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + Math.trunc(days) * MS_PER_DAY);
}

/** Adds calendar months, clamping to the last day of the target month. */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = toParts(date);
  const monthIndex = year * 12 + (month - 1) + Math.trunc(months);
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = (monthIndex % 12) + 1;
  return fromParts({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffInDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Completed calendar years between two dates (age-style calculation). */
export function fullYearsBetween(from: IsoDate, to: IsoDate): number {
  const a = toParts(from);
  const b = toParts(to);
  let years = b.year - a.year;
  if (b.month < a.month || (b.month === a.month && b.day < a.day)) years -= 1;
  return years;
}

/** The calendar date of `instant` in the given IANA time zone. */
export function isoDateInTimeZone(instant: Date, timeZone: string): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
