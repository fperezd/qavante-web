import { describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { csvCell } from "./csv";
import { exportTable } from "./table";
import { downloadXlsx, xlsxBytes, XLSX_MIME } from "./xlsx";
import { csv360Table } from "@/components/gestion/v08/gestion-v08-model";
import { docsToCsvTable } from "@/components/sii/libro-kpis/libro-kpis-format";

const attacks = [
  "=1+1",
  "+1+1",
  "-1+1",
  "@SUM(A1:A2)",
  '\t=HYPERLINK("https://example.invalid";"clic")',
  "＝1+1",
  "＋1+1",
  "－1+1",
  "＠SUM(A1:A2)",
];

async function read(bytes: Uint8Array) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  return book;
}

describe("Excel tipado", () => {
  it("Libro SII distingue los montos ausentes del cero real", async () => {
    const table = docsToCsvTable([
      {
        tipo_doc: 33,
        folio: 123,
        complete: true,
        neto_afecto: 0,
        exento: 0,
        iva: 0,
        otros_ajustes_residual: 0,
        total: 0,
      },
      { tipo_doc: 33, folio: 124, monto_iva: 0 },
    ]);
    const sheet = (await read(await xlsxBytes(table))).getWorksheet("Datos")!;
    expect(sheet.getCell("F2").value).toBe(0);
    expect(sheet.getCell("F3").value).toBeNull();
    expect(sheet.getCell("H3").value).toBeNull();
  });
  it("exporta el folio real del modelo 360 sin perder ceros ni el signo de una nota de crédito", async () => {
    const table = csv360Table([
      {
        fecha: "2026-09-09",
        folio: "000123",
        tipo: "Nota de crédito",
        monto: -1500,
        notaCredito: true,
      },
    ]);
    const sheet = (await read(await xlsxBytes(table))).getWorksheet("Datos")!;
    expect(sheet.getCell("B2").value).toBe("000123");
    expect(sheet.getCell("D2").value).toBe(-1500);
  });
  it("conserva folio exacto, monto numérico negativo, cero, vacío y fecha tras XLSX round-trip", async () => {
    const bytes = await xlsxBytes(
      exportTable(
        ["folio", "monto", "cero", "ausencia", "fecha", "texto"],
        [
          [
            csvCell.identifier("000123"),
            csvCell.decimal(-0.5),
            csvCell.integer(0),
            csvCell.missing(),
            csvCell.date("2026-09-09"),
            csvCell.text("=1+1"),
          ],
        ],
      ),
    );
    if (process.env.QAVANTE_XLSX_CORPUS) {
      const corpus = exportTable(
        ["folio", "monto", "cero", "ausencia", "fecha", "texto"],
        ["=1+1", ...attacks].map((attack) => [
          csvCell.identifier("000123"),
          csvCell.decimal(-0.5),
          csvCell.integer(0),
          csvCell.missing(),
          csvCell.date("2026-09-09"),
          csvCell.text(attack),
        ]),
      );
      writeFileSync(process.env.QAVANTE_XLSX_CORPUS, await xlsxBytes(corpus));
    }
    const book = await read(bytes);
    const sheet = book.getWorksheet("Datos")!;
    expect(sheet.getCell("A2").value).toBe("000123");
    expect(sheet.getCell("A2").numFmt).toBe("@");
    expect(sheet.getCell("B2").value).toBe(-0.5);
    expect(sheet.getCell("C2").value).toBe(0);
    expect(sheet.getCell("D2").value).toBeNull();
    expect(sheet.getCell("E2").value).toEqual(new Date("2026-09-09T00:00:00Z"));
    expect(sheet.getCell("F2").value).toBe("=1+1");
    const reopened = (await read(new Uint8Array(await book.xlsx.writeBuffer()))).getWorksheet(
      "Datos",
    )!;
    expect(reopened.getCell("A2").value).toBe("000123");
    expect(reopened.getCell("B2").value).toBe(-0.5);
    expect(reopened.getCell("F2").type).toBe(ExcelJS.ValueType.String);
  });

  it.each(attacks)("guarda %s como texto exacto y jamás como fórmula", async (attack) => {
    const book = await read(
      await xlsxBytes(
        exportTable([attack, "id"], [[csvCell.text(attack), csvCell.identifier(attack)]]),
      ),
    );
    const sheet = book.getWorksheet("Datos")!;
    for (const address of ["A1", "A2", "B2"]) {
      expect(sheet.getCell(address).value).toBe(attack);
      expect(sheet.getCell(address).type).toBe(ExcelJS.ValueType.String);
      expect(sheet.getCell(address).formula).toBeUndefined();
    }
    // Gemelo positivo: el arnés reconoce el objeto fórmula que NO usamos.
    sheet.getCell("C2").value = { formula: "1+1" };
    expect(sheet.getCell("C2").formula).toBe("1+1");
    expect(sheet.getCell("C2").type).toBe(ExcelJS.ValueType.Formula);
  });

  it.each(["", "NaN", "Infinity", "=1+1", "1,5", "9007199254740993"])(
    "rechaza decimal inválido %s sin convertirlo a cero",
    async (value) => {
      await expect(xlsxBytes(exportTable(["monto"], [[csvCell.decimal(value)]]))).rejects.toThrow();
    },
  );

  it("valida ancho aun si el caller no pasó por exportTable", async () => {
    await expect(
      xlsxBytes({ headers: ["a"], rows: [[csvCell.text("x"), csvCell.text("y")]], dialect: {} }),
    ).rejects.toThrow("expected 1");
  });

  it("descarga XLSX con MIME y extensión correctos", async () => {
    const anchor = { href: "", download: "", click: vi.fn() };
    let blob: Blob | undefined;
    vi.stubGlobal("document", { createElement: () => anchor });
    vi.stubGlobal("URL", {
      createObjectURL: (b: Blob) => {
        blob = b;
        return "blob:xlsx";
      },
      revokeObjectURL: vi.fn(),
    });
    try {
      await downloadXlsx(
        "../../ folios.xlsx",
        exportTable(["folio"], [[csvCell.identifier("000123")]]),
      );
      expect(anchor.download).toBe("folios.xlsx");
      expect(anchor.click).toHaveBeenCalledOnce();
      expect(blob?.type).toBe(XLSX_MIME);
      const sheet = (await read(new Uint8Array(await blob!.arrayBuffer()))).getWorksheet("Datos")!;
      expect(sheet.getCell("A2").value).toBe("000123");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
