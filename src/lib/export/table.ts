import type { CsvCell, CsvDialect } from "./csv";

/** Conserva los tipos originales hasta escoger el formato de descarga. */
export type ExportTable = Readonly<{
  headers: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<CsvCell>>;
  dialect: CsvDialect;
}>;

export function exportTable(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<CsvCell>>,
  dialect: CsvDialect = {},
): ExportTable {
  for (const row of rows) {
    if (row.length !== headers.length)
      throw new Error(`Export row has ${row.length} cells; expected ${headers.length}`);
  }
  return { headers, rows, dialect };
}
