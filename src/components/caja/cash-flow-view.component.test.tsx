import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CashFlowSinMovimientos } from "./cash-flow-view";
import type { CashFlowReportResponse } from "@/lib/api/treasury-reports";

/* El estado "este período no trajo buckets" es el que miente más fácil en una pantalla de
   caja: antes decía "Sin datos en este rango" y ahí terminaba. Dos cosas tenían que cambiar
   y las dos se fijan acá, porque las dos son afirmaciones sobre el dinero del usuario:

   - si el reporte EXCLUYÓ movimientos (moneda sin procedencia verificada, clasificación por
     revisar), el vacío NO es "no pasó nada": hay movimientos que quedaron fuera y el usuario
     tiene que saberlo. La tabla ya lo declaraba, pero la tabla no se renderiza sin buckets,
     así que el aviso se perdía justo en el caso donde más importa.
   - el estado tiene que terminar en algo que la persona pueda hacer mañana. */

const VACIO: CashFlowReportResponse = {
  buckets: [],
  currency: "functional",
  excluded_attention: 0,
  excluded_unverified_currency: 0,
  financial_layer: "committed",
  granularity: "week",
  group_by: "none",
  period_from: "2026-07",
  period_to: "2026-09",
};

describe("CashFlowSinMovimientos", () => {
  it("no cierra la pantalla en una negación: ofrece ampliar el período y clasificar", () => {
    const html = renderToStaticMarkup(<CashFlowSinMovimientos data={VACIO} />);

    expect(html).toContain("Clasificar movimientos");
    expect(html).toContain("/caja/por-clasificar");
    expect(html).not.toContain("Sin datos");
    expect(html).not.toContain("No hay movimientos");
  });

  it("declara los movimientos excluidos por moneda sin verificar en vez de mostrar un vacío liso", () => {
    const html = renderToStaticMarkup(
      <CashFlowSinMovimientos
        data={{
          ...VACIO,
          excluded_unverified_currency: 4,
          warnings: ["financial_impact_currency_unverified: 4"],
        }}
      />,
    );

    expect(html).toContain("4 movimientos");
    expect(html).toContain("moneda no está verificada");
    expect(html).toContain("incompletos");
    // El código de transporte del aviso nunca se le muestra al usuario.
    expect(html).not.toContain("financial_impact_currency_unverified");
  });

  it("declara los movimientos que quedaron fuera porque su clasificación necesita revisión", () => {
    const html = renderToStaticMarkup(
      <CashFlowSinMovimientos data={{ ...VACIO, excluded_attention: 1 }} />,
    );

    expect(html).toContain("1 movimiento del período quedó fuera del cálculo");
    expect(html).not.toContain("requires_attention");
  });

  it("sin exclusiones no inventa un aviso", () => {
    const html = renderToStaticMarkup(<CashFlowSinMovimientos data={VACIO} />);

    expect(html).not.toContain('role="alert"');
  });
});
