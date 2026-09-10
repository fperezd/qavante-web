/**
 * Único escritor de CSV del cliente. El tipo de cada celda es deliberado: un
 * monto negativo no se trata como fórmula. Conserva los bytes de identificadores
 * no peligrosos; CSV no codifica tipos y Excel puede inferir un folio como número.
 * Para conservarlo al importar, la columna debe declararse texto explícitamente.
 * El dialecto legacy de los exports UI es `;` + LF; no cambiarlo sin versión.
 */
export type CsvCell =
  | { kind: "text" | "identifier" | "date"; value: string }
  | { kind: "decimal" | "integer"; value: number | string }
  | { kind: "boolean"; value: boolean }
  | { kind: "missing" };

export type CsvDialect = Readonly<{ delimiter?: ";" | ","; eol?: "\n" | "\r\n" }>;

const DANGEROUS_FORMULA = /^[=+\-@]/;
// NFKC hace visibles =＋－＠ full-width; trim elimina espacios, tab y controles
// que Excel/Calc pueden ignorar antes de interpretar una fórmula.
function needsTextNeutralization(value: string): boolean {
  return DANGEROUS_FORMULA.test(value.normalize("NFKC").replace(/^[\s\u0000-\u001f]+/, ""));
}

function formatCell(cell: CsvCell): string {
  if (cell.kind === "missing") return "";
  if (cell.kind === "boolean") return cell.value ? "true" : "false";

  const raw = String(cell.value);
  const safe =
    (cell.kind === "text" || cell.kind === "identifier") && needsTextNeutralization(raw)
      ? `'${raw}`
      : raw;
  return /[";,\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function csv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<CsvCell>>,
  dialect: CsvDialect = {},
): string {
  const delimiter = dialect.delimiter ?? ";";
  const eol = dialect.eol ?? "\n";
  const header = headers.map((value) => formatCell({ kind: "text", value })).join(delimiter);
  const body = rows.map((row) => {
    if (row.length !== headers.length) {
      throw new Error(`CSV row has ${row.length} cells; expected ${headers.length}`);
    }
    return row.map(formatCell).join(delimiter);
  });
  return [header, ...body].join(eol);
}

/** Acepta contenido local o nativo API y garantiza exactamente un BOM UTF-8. */
export function csvWithBom(content: string): string {
  return `\uFEFF${content.replace(/^\uFEFF+/, "")}`;
}

/** Descarga segura en navegador: nombre estable, MIME CSV y una sola extensión. */
export function downloadCsv(filename: string, content: string): void {
  if (typeof document === "undefined") return;
  const basename =
    filename
      .replace(/\.csv$/i, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "") || "export";
  const blob = new Blob([csvWithBom(content)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${basename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const csvCell = {
  text: (value: string): CsvCell => ({ kind: "text", value }),
  identifier: (value: string): CsvCell => ({ kind: "identifier", value }),
  decimal: (value: number | string): CsvCell => ({ kind: "decimal", value }),
  integer: (value: number | string): CsvCell => ({ kind: "integer", value }),
  date: (value: string): CsvCell => ({ kind: "date", value }),
  boolean: (value: boolean): CsvCell => ({ kind: "boolean", value }),
  missing: (): CsvCell => ({ kind: "missing" }),
} as const;
