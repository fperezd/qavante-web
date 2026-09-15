import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { PresupuestoV09View } from "./presupuesto-v09-view";
import {
  PERIODO,
  RESULT_OPERATIONAL_RESULT,
  RESULT_OPERATIONAL_RESULT_DIVERGENTE,
  budgetVsActual,
  budgetVsActualIncompleto,
  budgetVsActualSinDesvios,
  budgetVsActualSinPresupuesto,
} from "./presupuesto-v09-fixtures";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";

/* V09 · Presupuesto — la vista, renderizada de verdad (react-dom/server, sin browser).
 *
 * Lo que se fija acá: Ley 2 (cero rojo — esta pantalla usa verde/ámbar para el desvío, nunca
 * rojo), Ley 1 (el "Real" viene de la MISMA respuesta que la tríada Y la tabla), el "no sé"
 * explícito de los tres estados de dato (sin_presupuesto/incompleto/completo, con gemelo
 * positivo), y la concordancia singular/plural con N=1. Las interacciones (ordenar/exportar la
 * tabla, Ley 7 a 360/320 px) viven en las stories. */

const PERIODO_LABEL = formatPeriodLabel(PERIODO);

function html(props: Partial<ComponentProps<typeof PresupuestoV09View>> = {}): string {
  return renderToStaticMarkup(
    <PresupuestoV09View periodoLabel={PERIODO_LABEL} bva={budgetVsActual()} {...props} />,
  );
}

function texto(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ley 2 — cuántos elementos llevan token rojo (ambos sistemas de tokens del repo). */
function rojos(h: string): number {
  return (h.match(/class="[^"]*(rediseno-rojo|danger-)[^"]*"/g) ?? []).length;
}

describe("PresupuestoV09View — Ley 2: cero rojo", () => {
  it("no lleva NINGÚN token de rojo en el caso normal (con desvíos a favor y en contra)", () => {
    expect(rojos(html())).toBe(0);
  });

  it("no lleva rojo en el estado sin presupuesto", () => {
    expect(rojos(html({ bva: budgetVsActualSinPresupuesto() }))).toBe(0);
  });

  it("no lleva rojo en el estado de error", () => {
    expect(rojos(html({ bva: undefined, error: "el motor de planificación no respondió" }))).toBe(
      0,
    );
  });

  it("no lleva rojo cuando el dato viene incompleto", () => {
    expect(rojos(html({ bva: budgetVsActualIncompleto() }))).toBe(0);
  });
});

describe("PresupuestoV09View — Ley 1: el Real es el Resultado de V08 (INV-FIN-001)", () => {
  it("el label de 'Real' declara la misma fuente que V08", () => {
    // `texto()` ya colapsa a una sola línea (sin \n), así que no hace falta el flag `s` (dotAll).
    expect(texto(html())).toMatch(/Real.*Resultado de Gestión \(V08\)/);
  });

  it("Plan/Real/Desvío de la tríada son lecturas directas de la línea result, no recalculadas", () => {
    const t = texto(html());
    // fixture: result budget=9.000.000, actual=10.900.000, variance=1.900.000
    expect(t).toContain("$9.000.000");
    expect(t).toContain("$10.900.000");
    expect(t).toContain("$1.900.000");
  });
});

describe("PresupuestoV09View — guard INV-FIN-001 canónico: result contra result (Ley 1)", () => {
  it("sin resultOperacional (todavía sin respuesta), el guard no corre: no aparece ningún banner de divergencia", () => {
    expect(texto(html())).not.toMatch(/no coincide con el/i);
  });

  it("[control positivo] con resultOperacional que CALZA (10.900.000), tampoco aparece el banner", () => {
    expect(texto(html({ resultOperacional: RESULT_OPERATIONAL_RESULT }))).not.toMatch(
      /no coincide con el/i,
    );
  });

  it("con resultOperacional que DIVERGE, declara AMBOS números — nunca elige uno en silencio", () => {
    const t = texto(html({ resultOperacional: RESULT_OPERATIONAL_RESULT_DIVERGENTE }));
    expect(t).toMatch(/no coincide con el/i);
    expect(t).toContain("$10.900.000"); // el Real que la tríada pinta (budget-vs-actual)
    expect(t).toContain("$9.000.000"); // el Resultado que declaró operational-result
  });

  it("[adversarial, PR #102 vuelta 2] revenue calza pero result diverge → el banner IGUAL aparece", () => {
    // REVENUE_OPERATIONAL_RESULT ("32500000") calzaría con la línea revenue del fixture, pero acá
    // se está guardando `result`, no `revenue` — exactamente el caso que la vuelta 1 no detectaba.
    const t = texto(html({ resultOperacional: RESULT_OPERATIONAL_RESULT_DIVERGENTE }));
    expect(t).toMatch(/no coincide con el/i);
  });

  it("el banner de divergencia no lleva token rojo (Ley 2)", () => {
    expect(rojos(html({ resultOperacional: RESULT_OPERATIONAL_RESULT_DIVERGENTE }))).toBe(0);
  });
});

describe("PresupuestoV09View — tríada", () => {
  it("Plan, Real y Desvío se muestran", () => {
    const t = texto(html());
    expect(t).toContain("Plan");
    expect(t).toContain("Real");
    expect(t).toContain("Desvío");
  });

  it("desvío favorable muestra 'a favor' y el pct del backend, sin recalcular", () => {
    expect(texto(html())).toContain("a favor · 21,1%");
  });

  it("[control positivo] desvío desfavorable muestra 'en contra' (mismo componente, otro dato)", () => {
    const enContra = budgetVsActual({
      lines: budgetVsActual().lines!.map((l) =>
        l.concept === "result" ? { ...l, variance: "-500000", variance_pct: "-5.6" } : l,
      ),
    });
    const t = texto(html({ bva: enContra }));
    expect(t).toContain("en contra · 5,6%");
    expect(t).not.toContain("a favor · 5,6%");
  });

  it("con plan 0 muestra el 0% contractual, nunca lo oculta por una guarda local", () => {
    const sinPlan = budgetVsActual({
      lines: budgetVsActual().lines!.map((l) =>
        l.concept === "result"
          ? { ...l, budget: "0", actual: "500000", variance: "500000", variance_pct: "0" }
          : l,
      ),
    });

    expect(texto(html({ bva: sinPlan }))).toContain("a favor · 0%");
  });
});

describe("PresupuestoV09View — tabla de desvíos", () => {
  it("lista los 3 conceptos con desvío (revenue/direct_cost/operating_expense)", () => {
    const t = texto(html());
    expect(t).toContain("Ingresos");
    expect(t).toContain("Costo directo");
    expect(t).toContain("Gastos operacionales");
  });

  it("el peor desvío (Costo directo, en contra) aparece antes que los a favor", () => {
    const h = html();
    const iCosto = h.indexOf("Costo directo");
    const iIngresos = h.indexOf("Ingresos");
    expect(iCosto).toBeGreaterThan(-1);
    expect(iCosto).toBeLessThan(iIngresos);
  });

  it("sin desvíos, dice 'clavado al plan' en vez de una tabla vacía muda", () => {
    const t = texto(html({ bva: budgetVsActualSinDesvios() }));
    expect(t).toContain("clavado al plan");
  });

  it("[control positivo] CON desvíos, el texto de 'clavado al plan' NO aparece", () => {
    expect(texto(html())).not.toContain("clavado al plan");
  });
});

describe("PresupuestoV09View — huecos declarados (issue #74)", () => {
  it("declara en pantalla que el link a documentos y la proyección de cierre faltan", () => {
    const t = texto(html());
    expect(t).toMatch(/detalle documental de cada desvío/i);
    expect(t).toMatch(/proyección de cierre del año/i);
  });

  it("no presenta referencias internas aunque se reciba la prop heredada", () => {
    expect(texto(html({ issueSucesor: "#101" }))).not.toContain("#101");
  });

  it("no ofrece NINGÚN link ni botón cuyo texto sea 'ver documentos' (el drill-down no existe)", () => {
    const h = html();
    expect(h).not.toMatch(/<a[^>]*>[^<]*ver documentos[^<]*<\/a>/i);
  });
});

describe("PresupuestoV09View — 'no sé' explícito (Ley 3)", () => {
  it("sin presupuesto: dice que no hay plan y ofrece proponerlo", () => {
    const t = texto(html({ bva: budgetVsActualSinPresupuesto() }));
    expect(t).toMatch(/todavía no tienes presupuesto/i);
  });

  it("[control positivo] CON presupuesto, ese mensaje NO aparece", () => {
    expect(texto(html())).not.toMatch(/todavía no tienes presupuesto/i);
  });

  it("dato incompleto: declara qué fuente falta, no lo esconde", () => {
    const t = texto(html({ bva: budgetVsActualIncompleto() }));
    expect(t).toMatch(/dato parcial/i);
    expect(t).toMatch(/1 fuente sin consultar/i);
    expect(t).not.toContain("sii_rcv");
  });

  it("[control positivo] con dato completo, el banner de 'dato parcial' NO aparece", () => {
    expect(texto(html())).not.toMatch(/dato parcial/i);
  });

  it("error: no refleja la causa técnica y ofrece reintentar", () => {
    const t = texto(html({ bva: undefined, error: "el motor de planificación no respondió" }));
    expect(t).toMatch(/no pudimos consultar el presupuesto/i);
    expect(t).not.toContain("motor de planificación");
  });

  it("[mutante nulo de control] los cuatro estados (normal/sin_presupuesto/incompleto/error) producen HTML distinto", () => {
    const normal = html();
    const sinPresupuesto = html({ bva: budgetVsActualSinPresupuesto() });
    const incompleto = html({ bva: budgetVsActualIncompleto() });
    const error = html({ bva: undefined, error: "x" });
    const variantes = [normal, sinPresupuesto, incompleto, error];
    for (let i = 0; i < variantes.length; i++) {
      for (let j = i + 1; j < variantes.length; j++) {
        expect(variantes[i]).not.toBe(variantes[j]);
      }
    }
  });
});

describe("PresupuestoV09View — concordancia singular/plural (N=1, issue #94)", () => {
  it("1 sola fuente faltante (singular) — no dice '1 fuentes'", () => {
    const t = texto(
      html({ bva: budgetVsActual({ data_state: "partial", missing_sources: ["sii"] }) }),
    );
    expect(t).toContain("1 fuente ");
    expect(t).not.toContain("1 fuentes");
  });

  it("[control positivo] con 2 fuentes faltantes, SÍ dice 'fuentes' (plural)", () => {
    const t = texto(
      html({ bva: budgetVsActual({ data_state: "partial", missing_sources: ["sii", "buk"] }) }),
    );
    expect(t).toContain("2 fuentes");
  });

  it("el footer de la tabla usa 'concepto desviado' en singular cuando hay 1 solo desvío", () => {
    const unSoloDesvio = budgetVsActual({
      lines: budgetVsActual().lines!.map((l) =>
        l.concept === "direct_cost" || l.concept === "operating_expense"
          ? { ...l, variance: "0", variance_pct: "0" }
          : l,
      ),
    });
    const t = texto(html({ bva: unSoloDesvio }));
    expect(t).toContain("1 concepto desviado");
    expect(t).not.toContain("1 conceptos desviados");
  });

  it("[control positivo] con varios desvíos, dice 'conceptos desviados' (plural)", () => {
    expect(texto(html())).toContain("conceptos desviados");
  });
});
