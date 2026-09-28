import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CashFlowReportResponse } from "@/lib/api/treasury-reports";
import { FlujoCajaWidget } from "@/components/inicio/v2/flujo-caja-widget";
import { CashFlowTable } from "./cash-flow-table";

/* #370 (qavante-api#905): el reporte de caja excluye de toda suma los impactos cuya moneda no
   tiene procedencia verificada. Las vistas que muestran esos totales deben declararlo; el código
   técnico del backend no llega a la pantalla. */

const CODIGO =
  "financial_impact_currency_unverified: 2 filas omitidas por moneda sin procedencia verificada; los totales están incompletos (no se asume CLP).";

function reporte(overrides: Partial<CashFlowReportResponse> = {}): CashFlowReportResponse {
  return {
    period_from: "2026-07",
    period_to: "2026-07",
    granularity: "month",
    financial_layer: "committed",
    group_by: "none",
    currency: "functional",
    buckets: [
      {
        period: "2026-07",
        total_inflow: "1000000",
        total_outflow: "-400000",
        net: "600000",
        row_count: 3,
      },
    ],
    grand_total: { inflow: "1000000", outflow: "-400000", net: "600000", row_count: 3 },
    excluded_attention: 0,
    excluded_unverified_currency: 0,
    warnings: [],
    ...overrides,
  } as CashFlowReportResponse;
}

describe("CashFlowTable · moneda no verificada", () => {
  it("declara cuántos movimientos quedaron fuera y oculta el código técnico", () => {
    const html = renderToStaticMarkup(
      <CashFlowTable data={reporte({ excluded_unverified_currency: 2, warnings: [CODIGO] })} />,
    );
    expect(html).toContain(
      "2 movimientos clasificados quedaron fuera de estos totales porque su moneda no está verificada.",
    );
    expect(html).not.toContain("financial_impact_currency_unverified");
  });

  it("gemelo: sin exclusiones no aparece el aviso", () => {
    const html = renderToStaticMarkup(<CashFlowTable data={reporte()} />);
    expect(html).toContain("Total del rango");
    expect(html).not.toContain("su moneda no está verificada");
  });
});

describe("FlujoCajaWidget (Inicio) · moneda no verificada", () => {
  const mes = { periodo: "2026-07", mesLabel: "julio", ingresos: 1, egresos: 1, neto: 0 };

  it("declara lo excluido junto a los meses", () => {
    const html = renderToStaticMarkup(
      <FlujoCajaWidget data={{ meses: [mes], ultimo: mes, excluidosMonedaNoVerificada: 1 }} />,
    );
    expect(html).toContain(
      "1 movimiento clasificado quedó fuera de estos totales porque su moneda no está verificada.",
    );
  });

  it("gemelo: sin exclusiones no hay aviso", () => {
    const html = renderToStaticMarkup(
      <FlujoCajaWidget data={{ meses: [mes], ultimo: mes, excluidosMonedaNoVerificada: 0 }} />,
    );
    expect(html).toContain("Flujo de caja");
    expect(html).not.toContain("su moneda no está verificada");
  });
});
