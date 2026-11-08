/**
 * Slovenian plural selection (one / two / few / other), following the
 * CLDR rules for `sl`: n mod 100 = 1 → one, = 2 → two, = 3..4 → few.
 */
export function pluralSl(count: number, forms: [one: string, two: string, few: string, other: string]): string {
  const n = Math.abs(Math.trunc(count)) % 100;
  if (n === 1) return forms[0];
  if (n === 2) return forms[1];
  if (n === 3 || n === 4) return forms[2];
  return forms[3];
}

export function countDevices(count: number): string {
  return `${count} ${pluralSl(count, ["naprava", "napravi", "naprave", "naprav"])}`;
}

export function countYears(count: number): string {
  return `${count} ${pluralSl(count, ["leto", "leti", "leta", "let"])}`;
}
