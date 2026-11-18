/**
 * Minimal RFC 4180 CSV reader and writer.
 *
 * Reading: strips a UTF-8 BOM, detects the delimiter (";" as written by
 * Slovenian Excel, or ",") from the header line, and supports quoted fields
 * with embedded delimiters, quotes and line breaks.
 *
 * Writing: every cell is quoted when needed, and cells that a spreadsheet
 * would evaluate as a formula (leading =, +, -, @, tab or carriage return)
 * are prefixed with an apostrophe (OWASP "CSV injection" guidance).
 */

export class CsvError extends Error {}

export type Delimiter = ";" | ",";

export function detectDelimiter(text: string): Delimiter {
  let semicolons = 0;
  let commas = 0;
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char === ";") semicolons += 1;
    else if (!quoted && char === ",") commas += 1;
  }
  return commas > semicolons ? "," : ";";
}

export function parseCsv(input: string): { rows: string[][]; delimiter: Delimiter } {
  const text = input.startsWith("﻿") ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let fieldStarted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
      fieldStarted = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      fieldStarted = false;
    } else {
      field += char;
      fieldStarted = true;
    }
  }
  if (quoted) throw new CsvError("Datoteka vsebuje narekovaj brez zaključka.");
  if (fieldStarted || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully empty lines (e.g. a trailing blank line).
  return { rows: rows.filter((r) => r.some((cell) => cell.trim() !== "")), delimiter };
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Neutralizes a value that a spreadsheet would interpret as a formula. */
export function neutralizeFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

/** Reverses neutralizeFormula for values that were exported by this app. */
export function restoreNeutralized(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

export function toCsv(
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
  delimiter: Delimiter = ";",
) {
  const encode = (cell: string | number | null | undefined) => {
    const value = neutralizeFormula(cell === null || cell === undefined ? "" : String(cell));
    return /["\n\r;,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return `﻿${rows.map((row) => row.map(encode).join(delimiter)).join("\r\n")}\r\n`;
}

/** Decodes uploaded bytes as UTF-8, falling back to Windows-1250 (Slovenian Excel default). */
export function decodeCsvBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}
