import { diffInDays, type IsoDate } from "./date-only";

const dateFormatter = new Intl.DateTimeFormat("sl-SI", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const longDateFormatter = new Intl.DateTimeFormat("sl-SI", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function isoToUtcDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Slovenian numeric date, e.g. `8. 11. 2026`. */
export function formatDate(date: IsoDate): string {
  return dateFormatter.format(isoToUtcDate(date));
}

/** Slovenian long date, e.g. `8. november 2026`. */
export function formatLongDate(date: IsoDate): string {
  return longDateFormatter.format(isoToUtcDate(date));
}

/**
 * Accusative form of "dan" after a number, as used in
 * "čez 1 dan / 2 dneva / 3 dni / 5 dni" and "zamuja 2 dneva".
 */
export function daysAccusative(count: number): string {
  const n = Math.abs(count) % 100;
  if (n === 1) return "dan";
  if (n === 2) return "dneva";
  return "dni";
}

/** Short relative description of a deadline compared with the reference date. */
export function describeDeadline(due: IsoDate, reference: IsoDate): string {
  const days = diffInDays(reference, due);
  if (days === 0) return "rok je danes";
  if (days > 0) return `čez ${days} ${daysAccusative(days)}`;
  const overdue = Math.abs(days);
  return `zamuja ${overdue} ${daysAccusative(overdue)}`;
}
