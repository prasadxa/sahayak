/**
 * Minimal RFC 4180 CSV writer (pure).
 *
 * - Fields containing a comma, double quote, CR or LF are quoted, and inner
 *   quotes are doubled. Records are separated by CRLF.
 * - The output starts with a UTF-8 BOM so Excel detects UTF-8 and shows
 *   Indic scripts correctly.
 * - Text that a spreadsheet would run as a formula (leading = + - @ tab CR)
 *   is prefixed with an apostrophe (OWASP "CSV injection"). Plain numbers
 *   and phone numbers such as "+91 98765 43210" are left alone.
 */

export const CSV_BOM = "﻿";

export type CsvColumn<T> = { readonly key: keyof T; readonly header: string };

const NEEDS_QUOTES = /[",\r\n]/;
const FORMULA_START = /^[=+\-@\t\r]/;
const NUMERIC_LIKE = /^[+-]?[\d\s().-]+$/;

function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (FORMULA_START.test(s) && !NUMERIC_LIKE.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => cell(row[c.key])).join(","));
  }
  return CSV_BOM + lines.join("\r\n");
}
