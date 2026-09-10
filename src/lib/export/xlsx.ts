import { toast } from "sonner";
import type { CsvCell } from "./csv";
import { exportTable, type ExportTable } from "./table";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function cellValue(cell: CsvCell): string | number | boolean | Date | null {
  if (cell.kind === "missing") return null;
  if (cell.kind === "boolean") return cell.value;
  if (cell.kind === "text" || cell.kind === "identifier") return cell.value;
  if (cell.kind === "date") {
    // No interpreta fechas ambiguas según el locale del equipo.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cell.value)) return cell.value;
    const value = new Date(`${cell.value}T00:00:00.000Z`);
    if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== cell.value)
      throw new Error("Fecha de exportación inválida");
    return value;
  }
  const raw = String(cell.value);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))
    throw new Error("Número de exportación inválido");
  const value = Number(raw);
  if (
    !Number.isFinite(value) ||
    Math.abs(value) > Number.MAX_SAFE_INTEGER ||
    (cell.kind === "integer" && !Number.isSafeInteger(value))
  )
    throw new Error("Número fuera del rango de exportación");
  return value;
}

/** ExcelJS se carga sólo al exportar. Strings nunca se asignan como objetos formula. */
export async function xlsxBytes(table: ExportTable): Promise<Uint8Array<ArrayBuffer>> {
  exportTable(table.headers, table.rows, table.dialect);
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Datos");
  sheet.addRow([...table.headers]);
  for (const cells of table.rows) {
    const row = sheet.addRow(cells.map(cellValue));
    cells.forEach((source, index) => {
      if (source.kind === "identifier" || source.kind === "text")
        row.getCell(index + 1).numFmt = "@";
      if (source.kind === "date" && row.getCell(index + 1).value instanceof Date)
        row.getCell(index + 1).numFmt = "yyyy-mm-dd";
    });
  }
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function downloadXlsx(filename: string, table: ExportTable): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    const bytes = await xlsxBytes(table);
    const basename =
      filename
        .replace(/\.(?:csv|xlsx)$/i, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^[._-]+|[._-]+$/g, "") || "export";
    const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }));
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${basename}.xlsx`;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    toast.error("No se pudo preparar el archivo Excel. Intenta nuevamente.");
  }
}
