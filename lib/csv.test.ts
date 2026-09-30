import { describe, expect, it } from "vitest";
import { CSV_BOM, toCsv } from "./csv";

type Row = { a: unknown; b: unknown };
const columns = [
  { key: "a", header: "A" },
  { key: "b", header: "B" },
] as const;

const body = (csv: string) => csv.slice(CSV_BOM.length);

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and uses CRLF line endings", () => {
    const csv = toCsv<Row>([{ a: 1, b: 2 }], columns);
    expect(CSV_BOM).toBe("﻿");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(body(csv)).toBe("A,B\r\n1,2");
  });

  it("writes only the header for no rows", () => {
    expect(body(toCsv<Row>([], columns))).toBe("A,B");
  });

  it("quotes fields containing commas, quotes and newlines (RFC 4180)", () => {
    const csv = toCsv<Row>(
      [
        { a: "Pune, MH", b: 'He said "no"' },
        { a: "line1\nline2", b: "cr\rhere" },
      ],
      columns
    );
    expect(body(csv)).toBe(
      'A,B\r\n"Pune, MH","He said ""no"""\r\n"line1\nline2","cr\rhere"'
    );
  });

  it("quotes headers that need it", () => {
    const csv = toCsv<Row>([], [
      { key: "a", header: "Society, name" },
      { key: "b", header: "B" },
    ]);
    expect(body(csv)).toBe('"Society, name",B');
  });

  it("renders empty values, booleans and numbers", () => {
    const csv = toCsv<Row>(
      [
        { a: undefined, b: null },
        { a: true, b: 12 },
      ],
      columns
    );
    expect(body(csv)).toBe("A,B\r\n,\r\ntrue,12");
  });

  it("keeps Indic scripts intact", () => {
    const csv = toCsv<Row>([{ a: "कर्ज मंजूर नहीं", b: "நாசிக்" }], columns);
    expect(body(csv)).toBe("A,B\r\nकर्ज मंजूर नहीं,நாசிக்");
  });

  it("neutralises spreadsheet formulas but leaves phone numbers alone", () => {
    const csv = toCsv<Row>(
      [
        { a: "=HYPERLINK(\"http://x\")", b: "@SUM(A1)" },
        { a: "+91 98765 43210", b: "-5" },
      ],
      columns
    );
    expect(body(csv)).toBe(
      'A,B\r\n"\'=HYPERLINK(""http://x"")",\'@SUM(A1)\r\n+91 98765 43210,-5'
    );
  });
});
