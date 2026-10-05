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

  /* EL CENTINELA DE EXTRANJERO NO AGRUPA. Dos proveedores distintos llegan con el mismo
     `55.555.555-5` (el SII no manda `null` para un extranjero, manda el centinela para todos).
     Antes compartían bucket: sus montos se sumaban y la fila se quedaba con el PRIMER nombre,
     así que una fila decía "ANTHROPIC concentra $300" con la plata de HETZNER adentro. */
  it("no funde dos extranjeras que comparten el centinela 55.555.555-5", () => {
    const rows = concentrationByCounterparty([
      complete({ rut_contraparte: "55555555-5", razon_social: "ANTHROPIC", total: 100 }),
      complete({ rut_contraparte: "55.555.555-5", razon_social: "HETZNER", total: 200 }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name).sort()).toEqual(["ANTHROPIC", "HETZNER"]);
    // Cada monto queda con su dueño, y ninguna fila reclama los $300 de las dos.
    expect(rows.find((r) => r.name === "HETZNER")!.total).toBe(200);
    expect(rows.find((r) => r.name === "ANTHROPIC")!.total).toBe(100);
    expect(rows.some((r) => r.total === 300)).toBe(false);
    // Y la fila no reclama un RUT que no distingue a nadie: `rut` queda en null y la vista
    // decide cómo nombrarlo. El centinela NO se publica como si identificara.
    expect(rows.every((r) => r.rut === null)).toBe(true);
  });

  it("gemelo: dos RUT reales distintos siguen siendo dos filas, y uno repetido sigue sumando", () => {
    const rows = concentrationByCounterparty([
      complete({ rut_contraparte: "76.123.456-0", razon_social: "Real Uno", total: 100 }),
      complete({ rut_contraparte: "76123456-0", razon_social: "Real Uno", total: 50 }),
      complete({ rut_contraparte: "77.777.777-7", razon_social: "Real Dos", total: 200 }),
    ]);
    expect(rows).toHaveLength(2);
    // El mismo RUT con y sin puntos NO se parte en dos filas.
    expect(rows.find((r) => r.name === "Real Uno")!.total).toBe(150);
    expect(rows.find((r) => r.name === "Real Uno")!.rut).toBe("76123456-0");
  });

  it("SIN-RUT y S/D tampoco agrupan entre sí ni con las extranjeras", () => {
    const rows = concentrationByCounterparty([
      complete({ rut_contraparte: "SIN-RUT", razon_social: "Sin Rut SpA", total: 10 }),
      complete({ rut_contraparte: "S/D", razon_social: "Otra Distinta", total: 20 }),
      complete({ rut_contraparte: "55555555-5", razon_social: "Extranjera", total: 30 }),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name).sort()).toEqual(["Extranjera", "Otra Distinta", "Sin Rut SpA"]);
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
