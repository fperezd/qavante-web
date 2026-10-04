import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OperationalResultResponse, OperationalResultV2Response } from "@/lib/api/gestion";
import { RESULTADO_CORRIDO, RESULTADO_HORIZONTE } from "@/lib/gestion-titulos";
import {
  OperationalResultCorridoView,
  rangoCorrido,
  ultimoMesCerrado,
} from "./operational-result-corrido-panel";
import { OperationalResultV2View } from "./operational-result-v2-panel";

/* Cifras de 2026-09 verificadas contra producción el 2026-10-04:
   `GET /api/management/operational-result?period=2026-09` → resultado 11.805.186 sobre
   ingresos de 34.334.204. El resto de las partes se eligen para que la identidad del contrato
   cierre: ebitda_proxy = gross_margin - labor_cost - professional_fees - recurring_expenses
   - unclassified_purchases - unclassified, y result = ebitda_proxy - financial_expense. */
function mesCorrido(): OperationalResultResponse {
  return {
    period: "2026-09",
    generated_at: "2026-10-04T12:00:00Z",
    revenue: "34334204",
    direct_cost: "6000000",
    gross_margin: "28334204",
    gross_margin_pct: "82.5",
    labor_cost: "11968052",
    professional_fees: "1500000",
    recurring_expenses: "2500000",
    unclassified_purchases: "300000",
    unclassified: "61016",
    financial_expense: "200000",
    ebitda_proxy: "12005186",
    result: "11805186",
    confidence: "high",
    data_state: "available",
    integrity: { decision_support: "eligible", period: "2026-09", state: "complete" },
    sources: [
      {
        code: "rcv",
        label: "Ventas y compras del SII",
        present: true,
        stale: false,
        applicable: true,
      },
      { code: "payroll", label: "Remuneraciones", present: true, stale: false, applicable: true },
    ],
    variation: {},
  };
}

/** El horizonte abstenido: lo que produce hoy el V2 en producción (el productor V14 responde
 *  500 desde el 19 de septiembre; la migración 0239 está en main y todavía no se aplicó). */
function horizonteAbstenido(): OperationalResultV2Response {
  return {
    as_of: "2026-10-04T23:59:59-03:00",
    calculation_version: "v2.2026-09-08",
    definition_id: "qavante.period_statement.v2",
    scope: {
      period_from: "2026-10",
      period_to: "2027-01",
      as_of: "2026-10-04T23:59:59-03:00",
      timezone: "America/Santiago",
    },
    authority: { source: "treasury.operating_metric_snapshots", snapshot_id: null },
    coverage: {
      status: "unavailable",
      decision_support: "abstain",
      reason_codes: ["v14_operating_snapshot_missing"],
    },
    statement_v2: null,
  };
}

describe("OperationalResultCorridoView", () => {
  it("publica el resultado del mes cerrado y dice qué período cubre", () => {
    const html = renderToStaticMarkup(<OperationalResultCorridoView mes={mesCorrido()} />);
    expect(html).toContain(RESULTADO_CORRIDO);
    // Lo que NO hacía la pantalla antes: decir de qué período habla la cifra.
    expect(html).toContain("sep 2026");
    expect(html).toContain("$34.334.204");
    expect(html).toContain("$11.805.186");
    expect(html).toContain("Apto para decidir");
  });

  it("el Costo Directo compuesto suma las tres partes y las deja a la vista", () => {
    const html = renderToStaticMarkup(<OperationalResultCorridoView mes={mesCorrido()} />);
    // 6.000.000 + 11.968.052 + 1.500.000. En este contrato `direct_cost` NO trae remuneraciones
    // ni honorarios; publicarlo solo como "Costo Directo" sería un costo subestimado.
    expect(html).toContain("$19.468.052");
    expect(html).toContain("$6.000.000");
    expect(html).toContain("$11.968.052");
    expect(html).toContain("$1.500.000");
  });

  it("una parte ilegible NO produce una suma parcial disfrazada de total", () => {
    const roto = { ...mesCorrido(), labor_cost: "no-es-un-decimal" };
    const html = renderToStaticMarkup(<OperationalResultCorridoView mes={roto} />);
    /* El mutante `parseAmountOrNull(p) ?? 0` publicaría $7.500.000 como Costo Directo: una cifra
       creíble y falsa (le faltan las remuneraciones enteras). Acá tiene que decir que no sabe. */
    expect(html).not.toContain("$7.500.000");
    expect(html).toContain("Sin dato");
    // Gemelo positivo con el MISMO render: con las tres partes legibles sí se publica el total.
    const sano = renderToStaticMarkup(<OperationalResultCorridoView mes={mesCorrido()} />);
    expect(sano).toContain("$19.468.052");
    expect(sano).not.toContain("Sin dato");
  });

  it("result = null se declara con su motivo y NO se convierte en $0", () => {
    const abstenido: OperationalResultResponse = {
      ...mesCorrido(),
      result: null,
      abstention_reason: "financial_integrity_partial",
      integrity: { decision_support: "abstain", period: "2026-09", state: "partial" },
    };
    const html = renderToStaticMarkup(<OperationalResultCorridoView mes={abstenido} />);
    expect(html).toContain("no publica el resultado final");
    expect(html).toContain("no usar para decidir");
    expect(html).not.toContain("$0<");
    // Un vacío en el resultado no es falta de datos en los ingresos: la cifra conocida se publica.
    expect(html).toContain("$34.334.204");
    // Los códigos internos no llegan a pantalla.
    expect(html).not.toContain("financial_integrity_partial");
  });

  it("ultimoMesCerrado no abre en el mes en curso", () => {
    expect(ultimoMesCerrado("2026-10")).toBe("2026-09");
    expect(ultimoMesCerrado("2026-01")).toBe("2025-12");
  });

  it("el rango se escribe con el mismo formato que el bloque del horizonte", () => {
    expect(rangoCorrido("2026-09")).toBe("sep 2026 · base devengada · CLP");
  });
});

describe("/gestion con un bloque con cifras y el otro abstenido", () => {
  /* Éste es el estado REAL de producción al 2026-10-04, no un borde raro: lo corrido tiene
     datos y el horizonte está abstenido. La pantalla tiene que leerse bien así. */
  const html =
    renderToStaticMarkup(<OperationalResultCorridoView mes={mesCorrido()} />) +
    renderToStaticMarkup(<OperationalResultV2View response={horizonteAbstenido()} />);

  it("los dos bloques aparecen con rótulos DISTINTOS", () => {
    expect(html).toContain(RESULTADO_CORRIDO);
    expect(html).toContain(RESULTADO_HORIZONTE);
    expect(RESULTADO_HORIZONTE).not.toBe(RESULTADO_CORRIDO);
    /* CONTROL NEGATIVO: si los dos volvieran a llamarse "Resultado operacional", el título
       aparecería DOS veces en la pantalla. Con rótulos distintos aparece exactamente una. */
    const vecesCorrido = html.split(`>${RESULTADO_CORRIDO}<`).length - 1;
    expect(vecesCorrido, "el mismo título aparece en los dos bloques").toBe(1);
  });

  it("cada bloque declara su propio período, y no son el mismo", () => {
    expect(html).toContain("sep 2026 · base devengada · CLP");
    // El horizonte de 90 días abierto el 4 de octubre cubre oct 2026 a ene 2027.
    expect(html).toContain("oct 2026 a ene 2027");
  });

  it("el bloque abstenido muestra su abstención con período, sin cifras inventadas", () => {
    const soloHorizonte = renderToStaticMarkup(
      <OperationalResultV2View response={horizonteAbstenido()} />,
    );
    expect(soloHorizonte).toContain("se abstuvo de publicar");
    expect(soloHorizonte).toContain("oct 2026 a ene 2027");
    expect(soloHorizonte).not.toContain("$0");
    expect(soloHorizonte).not.toContain("v14_operating_snapshot_missing");
  });
});
