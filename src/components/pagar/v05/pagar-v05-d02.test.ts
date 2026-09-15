import { describe, expect, it } from "vitest";
import { pagos } from "./pagar-v05-fixtures";
import {
  conteosServidor,
  kpiCritico,
  kpiVencidoGlobal,
  nombreExportPagina,
  pagosV05,
  queryFiltroServidor,
} from "./pagar-v05-model";

describe("Pagar V05 D02", () => {
  it("usa agregados globales aunque la página no contenga esas filas", () => {
    const ap = pagos({ items: [], items_total: 101 });
    expect(kpiVencidoGlobal(ap)).toMatchObject({ total: 8729650, n: 3, completo: true });
    expect(kpiCritico([], ap)).toMatchObject({ total: 16807705, n: 6, completo: true });
  });

  it("falla cerrado si el agregado excluye moneda o fecha", () => {
    const ap = pagos({
      overdue_summary: {
        amount_clp: null,
        known_amount_clp: "2500",
        complete: false,
        count: 1,
        unknown_due_date_count: 1,
        excluded_by_currency: [{ currency: "USD", amount: "20" }],
      },
    });
    expect(kpiVencidoGlobal(ap)).toMatchObject({
      total: null,
      conocido: 2500,
      sinFecha: 1,
      monedasExcluidas: 1,
    });
  });

  it("consume facets y traduce filtros al servidor sin confundir criticidad con crítico", () => {
    expect(conteosServidor(pagos())).toMatchObject({ alta: 5, impuestos: 1, remuneraciones: 1 });
    expect(queryFiltroServidor("alta", "2026-08-30")).toEqual({ criticality: "high" });
    expect(queryFiltroServidor("vencidos", "2026-08-30")).toEqual({ due_to: "2026-08-29" });
  });

  it("una fila sin moneda no se convierte silenciosamente a CLP", () => {
    const ap = pagos({ items: [{ ...pagos().items![0]!, currency: undefined }] });
    expect(pagosV05(ap, new Date("2026-08-30T12:00:00Z"), [])[0]).toMatchObject({
      moneda: "SIN MONEDA",
      montoClp: null,
      sinConvertir: true,
    });
  });

  it("nombra explícitamente la página exportada", () => {
    expect(nombreExportPagina(3)).toBe("pagos-por-pagar-pagina-3.xlsx");
  });
});
