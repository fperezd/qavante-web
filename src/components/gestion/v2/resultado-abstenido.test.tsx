/* Copy de la vista ABSTENIDA de Gestión (web#318).
 *
 * Dos reglas se cruzan en esta vista y el test fija las dos, porque arreglar una rompiendo la otra
 * es justamente lo que pasó antes:
 *
 * 1. web#318 — con `result: null` el productor se abstuvo. La vista NO puede fabricar el "$0" ni
 *    afirmar "El negocio ganó este mes", ni comparar el mes anterior contra ese cero.
 * 2. Copy de Fernando (2026-10-01) — tampoco puede poner un cartel de "no disponible". Las
 *    palabras de certeza ("no disponible", "preliminar", "estimado", "confianza media") ensucian
 *    cifras que sí están medidas y dejan al dueño sin nada con que decidir. Siempre un número, qué
 *    cubre, y la acción concreta.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OperationalResultResponse } from "@/lib/api/gestion";
import { ResultadoAbstenido } from "./gestion-v2-view-live";
import { ResultadoPendiente } from "./gestion-seccion-view";

/** Palabras que NO pueden aparecer en una cifra financiera de Qavante. */
const PROHIBIDAS = [
  "no disponible",
  "no hay dato",
  "sin dato",
  "preliminar",
  "estimado",
  "confianza baja",
  "confianza media",
  "confianza alta",
  "no podemos",
  "se abstuvo",
];

/** Payload real del corte que abrió el issue (tenant Tooxs, ago-2026): el productor abstiene el
 *  resultado pero las ventas y los costos directos del mes SÍ están acreditados. */
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
  variation: {
    vs_previous_month: { amount: null, pct: null, abstention_reason: "current_period_abstained" },
    vs_same_month_last_year: {
      amount: null,
      pct: null,
      abstention_reason: "current_period_abstained",
    },
  },
  confidence: "low",
  data_state: "partial",
  generated_at: "2026-09-16T01:10:00Z",
} as unknown as OperationalResultResponse;

describe("ResultadoAbstenido · hero de Gestión", () => {
  const html = renderToStaticMarkup(<ResultadoAbstenido mes={ABSTENIDO} period="2026-08" />);

  it("NO fabrica el resultado en $0 ni afirma que el negocio ganó (web#318)", () => {
    expect(html).not.toContain("El negocio ganó este mes");
    expect(html).not.toContain("El negocio perdió este mes");
    // El "$0" del defecto original: no aparece ninguna cifra en cero presentada como resultado.
    expect(html).not.toContain("Resultado operacional de");
    // Y la variación contra ese cero tampoco ("$2.110.198 peor que el mes pasado").
    expect(html).not.toMatch(/peor que el mes pasado|mejor que el mes pasado/);
  });

  it("NO usa palabras de incertidumbre sobre las cifras (copy 2026-10-01)", () => {
    const plano = html.toLowerCase();
    for (const palabra of PROHIBIDAS) {
      expect(plano, `copy prohibido: "${palabra}"`).not.toContain(palabra);
    }
  });

  it("SÍ muestra las cifras que acreditan el mes (gemelo positivo)", () => {
    // Las tres líneas reales del corte, formateadas en es-CL.
    expect(html).toContain("39.443.831"); // ventas
    expect(html).toContain("7.282.063"); // costos directos
    expect(html).toContain("32.161.768"); // margen bruto
    expect(html).toContain("Margen bruto");
  });

  it("SÍ dice qué cubre el número en vez de cuán seguro está el sistema", () => {
    expect(html).toContain("Cubre las ventas emitidas y los costos directos");
  });

  it("SÍ da la acción concreta con el enlace para ejecutarla", () => {
    // Lo que el dueño hace distinto mañana: conectar la fuente que falta.
    expect(html).toContain("Conecta remuneraciones para cerrar el resultado de agosto");
    expect(html).toContain('href="/conexiones"');
  });

  it("NO pinta las causas técnicas de integridad (viven en la API y la auditoría)", () => {
    expect(html).not.toContain("payroll source does not cover");
  });

  it("sin missing_sources igual da acción y cifras, nunca un cartel vacío", () => {
    const sinFuentes = { ...ABSTENIDO, missing_sources: [] } as OperationalResultResponse;
    const h = renderToStaticMarkup(<ResultadoAbstenido mes={sinFuentes} period="2026-08" />);
    expect(h).toContain("Sincroniza agosto 2026 para cerrar el resultado del mes");
    expect(h).toContain("39.443.831");
    expect(h.toLowerCase()).not.toContain("no disponible");
  });
});

describe("ResultadoPendiente · subpáginas de Gestión", () => {
  const html = renderToStaticMarkup(<ResultadoPendiente mes={ABSTENIDO} />);

  it("NO usa palabras de incertidumbre", () => {
    const plano = html.toLowerCase();
    for (const palabra of PROHIBIDAS) {
      expect(plano, `copy prohibido: "${palabra}"`).not.toContain(palabra);
    }
  });

  it("SÍ muestra cifras acreditadas + acción (gemelo positivo)", () => {
    expect(html).toContain("39.443.831");
    expect(html).toContain("32.161.768");
    expect(html).toContain("Conecta remuneraciones para cerrar el mes");
    expect(html).toContain('href="/conexiones"');
  });
});
