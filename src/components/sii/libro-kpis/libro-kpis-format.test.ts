import { describe, expect, it } from "vitest";
import { csvCell } from "@/lib/export/csv";
import { concentrationByCounterparty, docsToCsv, docsToCsvTable } from "./libro-kpis-format";
import type { RcvDoc } from "../rcv-grouped-item";

const complete = (overrides: Partial<RcvDoc>): RcvDoc => ({
  tipo_doc: 33,
  complete: true,
  neto_afecto: 100,
  exento: 0,
  iva: 19,
  otros_ajustes_residual: 0,
  total: 119,
  ...overrides,
});

describe("libro-kpis-format", () => {
  it("concentración netea NC sólo desde el bridge completo", () => {
    const rows = concentrationByCounterparty([
      complete({ rut_contraparte: "1-9", razon_social: "Uno", total: 119 }),
      complete({ tipo_doc: 61, rut_contraparte: "1-9", razon_social: "Uno", total: 19 }),
      complete({ rut_contraparte: "2-7", razon_social: "Dos", total: 238 }),
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ rut: "2-7", total: 238 }),
      expect.objectContaining({ rut: "1-9", total: 100 }),
    ]);
  });

  it("no publica concentración parcial usando monto_total histórico", () => {
    const rows = concentrationByCounterparty([
      complete({ rut_contraparte: "1-9", razon_social: "Completo" }),
      { tipo_doc: 33, rut_contraparte: "2-7", razon_social: "Parcial", monto_total: 999999 },
    ] as RcvDoc[]);
    expect(rows).toEqual([]);
  });

  it("exporta sólo componentes canónicos y marca las filas incompletas", () => {
    const table = docsToCsvTable([
      complete({
        folio: 1,
        neto_afecto: 0,
        exento: 10,
        iva: 0,
        otros_ajustes_residual: 0,
        total: 10,
      }),
      { tipo_doc: 33, folio: 2, monto_neto: 999, monto_iva: 99, monto_total: 1098 },
    ] as RcvDoc[]);
    expect(table.headers).toEqual(
      expect.arrayContaining(["Neto afecto", "Exento", "Otros/ajustes", "Desglose"]),
    );
    expect(table.rows[0]?.slice(5)).toEqual([
      csvCell.decimal(0),
      csvCell.decimal(10),
      csvCell.decimal(0),
      csvCell.decimal(0),
      csvCell.decimal(10),
      csvCell.text("completo"),
    ]);
    expect(table.rows[1]?.slice(5)).toEqual([
      csvCell.missing(),
      csvCell.missing(),
      csvCell.missing(),
      csvCell.missing(),
      csvCell.missing(),
      csvCell.text("incompleto"),
    ]);
    expect(docsToCsv([complete({ razon_social: 'Bar "El Rincón"' })])).toContain(
      '"Bar ""El Rincón"""',
    );
  });
});
