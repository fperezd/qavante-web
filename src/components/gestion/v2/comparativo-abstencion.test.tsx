/* Comparativo con un mes ABSTENIDO (web#366, residual de web#318).
 *
 * El productor publica `result: null` + `abstention_reason` cuando una fuente requerida no cubre
 * el período (qavante-api#888). Esta vista leía `result` con `parseAmount` sin consultar la
 * abstención, y `parseAmount(null)` devuelve **0**. Ese cero no se veía como una ausencia: se veía
 * como una cifra normal, y la aritmética lo propagaba a dos lugares distintos.
 *
 * 1. `Δ gastos operacionales` sale de `gmC - resC - (gmP - resP)`. Con `resC = 0` fabricado el
 *    paso de gastos ABSORBE todo el margen bruto del mes y se pinta como un salto de gasto que no
 *    ocurrió — con color favorable/desfavorable incluido. No es el dato ausente ni el dato real:
 *    es una tercera cosa que produjo la aritmética.
 * 2. `netoPct` publicaba `0%` de margen neto para el mes abstenido. En porcentaje la mentira es
 *    peor que en pesos: "0%" afirma que el mes vendió y no ganó nada.
 *
 * Y la baldosa de "Resultado" mostraba `$0` en el bloque más visible de la pantalla.
 *
 * Cada test tiene su GEMELO POSITIVO: lo que el mes SÍ acredita tiene que seguir en pantalla. Un
 * arreglo que vaciara el bloque pasaría la mitad negativa de esta suite y sería el otro defecto
 * (el cartel de "no disponible" que la regla de copy prohíbe).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OperationalResultResponse } from "@/lib/api/gestion";
import { Eficiencia, PuenteVariacion, metricasAcreditadas } from "./comparativo-view";

/** Palabras que NO pueden aparecer en una cifra financiera de Qavante (copy de Fernando
 *  2026-10-01). Espeja la lista de `resultado-abstenido.test.tsx`: la regla es una sola. */
const PROHIBIDAS = [
  "no disponible",
  "no hay dato",
  "sin dato",
  "sin información",
  "preliminar",
  "estimado",
  "no evaluable",
  "confianza baja",
  "confianza media",
  "confianza alta",
  "se abstuvo",
];

/** Mes ABSTENIDO: el corte real del tenant Tooxs (ago-2026) que abrió web#318. Las ventas, los
 *  costos directos y el margen bruto SÍ están acreditados; el resultado no se publica. */
const ABSTENIDO = {
  period: "2026-08",
  revenue: "39443831",
  direct_cost: "7282063",
  gross_margin: "32161768",
  gross_margin_pct: "81.5",
  labor_cost: "0",
  professional_fees: "0",
  recurring_expenses: "0",
  unclassified_purchases: "0",
  unclassified: "0",
  financial_expense: "0",
  ebitda_proxy: "0",
  result: null,
  abstention_reason: "financial_integrity_partial",
  missing_sources: ["remuneraciones"],
  integrity: {
    period: "2026-08",
    state: "partial",
    decision_support: "abstain",
    reasons: ["payroll source does not cover 2026-08"],
  },
  variation: null,
  confidence: "low",
  data_state: "partial",
  generated_at: "2026-09-16T01:10:00Z",
} as unknown as OperationalResultResponse;

/** Mes PUBLICABLE (el otro lado de la comparación): resultado acreditado. */
const PUBLICABLE = {
  ...ABSTENIDO,
  period: "2026-07",
  revenue: "30000000",
  direct_cost: "6000000",
  gross_margin: "24000000",
  gross_margin_pct: "80",
  result: "4000000",
  abstention_reason: null,
  missing_sources: [],
  integrity: {
    period: "2026-07",
    state: "complete",
    decision_support: "eligible",
    reasons: [],
  },
} as unknown as OperationalResultResponse;

function sinPalabrasProhibidas(html: string) {
  const plano = html.toLowerCase();
  for (const palabra of PROHIBIDAS) {
    expect(plano, `copy prohibido: "${palabra}"`).not.toContain(palabra);
  }
}

describe("PuenteVariacion · la cascada se corta en el último nivel acreditado por AMBOS meses", () => {
  const html = renderToStaticMarkup(<PuenteVariacion cur={ABSTENIDO} prev={PUBLICABLE} />);

  it("NO publica el paso de gastos derivado del resultado abstenido", () => {
    expect(html).not.toContain("Cambio en gastos");
  });

  it("NO publica la cifra que la aritmética fabricaba para ese paso", () => {
    /* CONTRASTE MEDIDO. Con `resC = 0` el paso valía `gmC - 0 - (gmP - resP)`:
       32.161.768 − (24.000.000 − 4.000.000) = 12.161.768, pintado con signo y color como si el
       gasto hubiera subido $12,2M. Esa cifra no existe en ninguna parte del contrato. */
    expect(html).not.toContain("12.161.768");
  });

  it("NO publica las dos filas de resultado (una de ellas sería el $0 fabricado)", () => {
    expect(html).not.toContain("Resultado este mes");
    expect(html).not.toContain("Resultado mes anterior");
  });

  it("GEMELO POSITIVO: los Δ que los dos meses SÍ acreditan se siguen mostrando", () => {
    expect(html).toContain("Cambio en ingresos");
    expect(html).toContain("Cambio en costo de ventas");
    // Δ ingresos = 39.443.831 − 30.000.000 = 9.443.831 (sale de `revenue`, siempre publicado).
    expect(html).toContain("9.443.831");
  });

  it("dice QUÉ cubre la comparación y qué fuente la cierra, con la fuente nombrada", () => {
    expect(html).toContain("las ventas y el costo de ventas");
    expect(html).toContain("remuneraciones");
  });

  it("no usa ninguna palabra de desconfianza", () => sinPalabrasProhibidas(html));

  it("da igual de qué lado esté la abstención: el mes anterior abstenido corta lo mismo", () => {
    const h = renderToStaticMarkup(<PuenteVariacion cur={PUBLICABLE} prev={ABSTENIDO} />);
    expect(h).not.toContain("Cambio en gastos");
    expect(h).not.toContain("Resultado mes anterior");
    expect(h).toContain("Cambio en ingresos");
    expect(h).toContain("remuneraciones");
  });

  it("GEMELO POSITIVO: con los dos meses acreditados la cascada va COMPLETA", () => {
    const h = renderToStaticMarkup(
      <PuenteVariacion cur={{ ...PUBLICABLE, period: "2026-08" }} prev={PUBLICABLE} />,
    );
    expect(h).toContain("Cambio en ingresos");
    expect(h).toContain("Cambio en costo de ventas");
    expect(h).toContain("Cambio en gastos"); // ← el paso que la abstención corta
    expect(h).toContain("Resultado este mes");
    expect(h).toContain("Resultado mes anterior");
    // Y NO aparece la frase de lo pendiente: no hay nada pendiente.
    expect(h).not.toContain("cubra los dos períodos");
  });
});

describe("Eficiencia · el margen neto no se deriva de un resultado abstenido", () => {
  const html = renderToStaticMarkup(<Eficiencia cur={ABSTENIDO} prev={PUBLICABLE} />);

  it("NO publica el 0% de margen neto que la aritmética fabricaba", () => {
    expect(html).not.toContain("Margen neto");
    // El "0%" / "0,0%" del defecto, en cualquiera de sus formas.
    expect(html).not.toMatch(/\b0,0\s*%/);
  });

  it("GEMELO POSITIVO: el margen BRUTO sí se publica (el contrato lo acredita)", () => {
    expect(html).toContain("Margen bruto %");
    expect(html).toContain("81,5"); // gross_margin_pct del corte real
  });

  it("dice qué cubre el margen bruto y qué falta para el neto, nombrando la fuente", () => {
    expect(html).toContain("El margen bruto cubre las ventas y el costo de ventas");
    expect(html).toContain("remuneraciones");
  });

  it("no usa ninguna palabra de desconfianza (antes decía «Sin información»)", () =>
    sinPalabrasProhibidas(html));

  it("GEMELO POSITIVO: con el mes acreditado el margen neto SÍ se publica", () => {
    const h = renderToStaticMarkup(<Eficiencia cur={PUBLICABLE} prev={PUBLICABLE} />);
    expect(h).toContain("Margen neto %");
    // 4.000.000 / 30.000.000 = 13,3%
    expect(h).toMatch(/13,3/);
    expect(h).not.toContain("cubra el período");
  });

  it("el mes de REFERENCIA abstenido no aporta una comparación contra su cero", () => {
    const h = renderToStaticMarkup(<Eficiencia cur={PUBLICABLE} prev={ABSTENIDO} />);
    expect(h).toContain("Margen neto %"); // el mes actual sí acredita
    // Pero la referencia del mes anterior no se arma contra el 0 fabricado.
    expect(h).not.toMatch(/mes ant\. 0,0/);
    sinPalabrasProhibidas(h);
  });
});

describe("metricasAcreditadas · la baldosa de Resultado no muestra un $0 fabricado", () => {
  it("con el resultado abstenido se cae la métrica de Resultado", () => {
    const keys = metricasAcreditadas(ABSTENIDO).map((m) => m.key);
    expect(keys).not.toContain("result");
  });

  it("GEMELO POSITIVO: y quedan las dos que el contrato publica igual", () => {
    const keys = metricasAcreditadas(ABSTENIDO).map((m) => m.key);
    expect(keys).toEqual(["revenue", "gross_margin"]);
  });

  it("GEMELO POSITIVO: con el mes acreditado van las tres", () => {
    expect(metricasAcreditadas(PUBLICABLE).map((m) => m.key)).toEqual([
      "revenue",
      "gross_margin",
      "result",
    ]);
  });

  it('un `result: "0"` MEDIDO no se confunde con una abstención (sí se muestra)', () => {
    const ceroMedido = {
      ...PUBLICABLE,
      result: "0",
      abstention_reason: null,
    } as OperationalResultResponse;
    expect(metricasAcreditadas(ceroMedido).map((m) => m.key)).toContain("result");
  });

  it("sin respuesta todavía no se recorta nada (es carga, no abstención)", () => {
    expect(metricasAcreditadas(undefined).map((m) => m.key)).toContain("result");
  });
});
