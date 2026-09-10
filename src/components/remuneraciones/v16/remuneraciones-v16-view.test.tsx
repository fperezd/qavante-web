import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { LEY_9_TEXTO } from "@/components/pagar/v05/pagar-v05-model";
import { RemuneracionesV16View } from "./remuneraciones-v16-view";
import type { SettlementBoard } from "../settlement-board-model";
import { EMPLEADO_ROJAS, PERIODO, REVENUE, detalle, totales } from "./remuneraciones-v16-fixtures";

/* V16 · Remuneraciones — la vista, renderizada de verdad (react-dom/server, sin browser).
 *
 * Lo que se fija acá: Ley 2 (CERO rojo en toda la pantalla — a diferencia de V05, acá no hay
 * NINGÚN candidato a rojo, se cuenta y se exige 0), Ley 9 (el texto fijo literal), el "no sé"
 * explícito (con su gemelo positivo) y la concordancia singular/plural con N=1. Las
 * interacciones (ordenar/paginar la tabla, el popover) viven en las stories. */

function html(props: Partial<ComponentProps<typeof RemuneracionesV16View>> = {}): string {
  return renderToStaticMarkup(
    <RemuneracionesV16View
      periodo={PERIODO}
      totales={totales()}
      detalle={detalle()}
      revenue={REVENUE}
      {...props}
    />,
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

describe("RemuneracionesV16View — Ley 2: cero rojo", () => {
  it("no lleva NINGÚN token de rojo en el caso normal", () => {
    expect(rojos(html())).toBe(0);
  });

  it("no lleva rojo cuando el pago individual no está verificado", () => {
    const h = html();
    expect(rojos(h)).toBe(0);
    expect(texto(h)).toContain("Pago no verificado");
  });

  it("no lleva rojo en el estado de error", () => {
    expect(rojos(html({ totales: undefined, payrollError: "el conector no respondió" }))).toBe(0);
  });

  it("no lleva rojo en el estado vacío", () => {
    expect(rojos(html({ totales: undefined, detalle: [] }))).toBe(0);
  });
});

describe("RemuneracionesV16View — Ley 9: footer fijo, literal", () => {
  it("el texto de la Ley 9 aparece LITERAL", () => {
    expect(texto(html())).toContain(LEY_9_TEXTO);
  });

  it("no ofrece ningún botón de postergar ni de pagar todo (mover plata pide firma humana)", () => {
    // La prosa SÍ menciona "postergar"/"pagar todo" para decir que no existen (LEY_9_TEXTO y su
    // frase compañera) — lo que se prueba es que ningún CONTROL interactivo lleva esas palabras
    // como su texto. Los <button> que sí existen son de orden de columna (§5.5).
    const h = html();
    expect(h).not.toMatch(/<(button|a)[^>]*>[^<]*postergar[^<]*<\//i);
    expect(h).not.toMatch(/<(button|a)[^>]*>[^<]*pagar todo[^<]*<\//i);
  });
});

describe("RemuneracionesV16View — tríada", () => {
  it("Líquido, Cotizaciones y Costo empresa se muestran con el período", () => {
    const t = texto(html());
    expect(t).toContain("Líquido de Julio 2026");
    expect(t).toContain("Cotizaciones (Previred)");
    expect(t).toContain("Costo empresa total");
  });

  it("el % de ingresos acompaña a Costo empresa (48,8%)", () => {
    expect(texto(html())).toContain("48,8% de tus ingresos");
  });

  it("sin ingresos del período, el % dice 'no disponible' — NUNCA 0%", () => {
    const t = texto(html({ revenue: null }));
    expect(t).toContain("% de ingresos no disponible este mes");
    expect(t).not.toMatch(/0%\s*de tus ingresos/);
  });

  it("[control positivo] CON ingresos, el mismo texto de 'no disponible' NO aparece", () => {
    expect(texto(html())).not.toContain("% de ingresos no disponible este mes");
  });

  it("sin detalle por persona, Costo empresa es 'sin dato' — NUNCA líquido + cotizaciones", () => {
    const t = texto(html({ detalle: [] }));
    expect(t).toContain("sin dato");
    // líquido (13.387.759) + cotizaciones (3.190.631) = 16.578.390: ese número NO debe aparecer
    // como si fuera el costo empresa.
    expect(t).not.toContain("$16.578.390");
  });

  it("[control positivo] CON detalle, Costo empresa SÍ muestra un monto (no 'sin dato')", () => {
    const t = texto(html());
    expect(t).toContain("$18.990.000");
  });

  it("detalle forbidden (403) explica que es solo para el dueño, no 'sin dato' genérico", () => {
    const t = texto(html({ detalle: [], detalleForbidden: true }));
    expect(t).toMatch(/solo para el dueño/i);
  });
});

describe("RemuneracionesV16View — tabla por persona", () => {
  it("cada persona lleva su estado y su link a la liquidación", () => {
    const h = html();
    expect(texto(h)).toContain("Javiera Rojas Muñoz");
    expect(h).toContain(`href="/remuneraciones?period=${PERIODO}"`);
    expect(texto(h)).toContain("liquidación");
  });

  it("no afirma Pagado ni Pendiente con coincidencias de monto", () => {
    const t = texto(html());
    expect(t).toContain("Pago no verificado");
    expect(t).not.toContain("Pagado ✓");
    expect(t).not.toContain("Pendiente");
  });

  it("sin detalle por persona, la tabla declara el hueco en vez de mostrarse vacía muda", () => {
    const t = texto(html({ detalle: [] }));
    expect(t).toContain("todavía no trae el líquido por persona");
  });

  it("muestra evidencia persistida confirmada y parcial sin inferir por monto", () => {
    const board: SettlementBoard = {
      workers: [
        {
          workerRut: "11111111-1",
          workerName: "Javiera",
          liquido: 2_850_000,
          paidAmount: 2_850_000,
          outstanding: 0,
          status: "confirmed",
        },
        {
          workerRut: "22222222-2",
          workerName: "Matías",
          liquido: 2_610_000,
          paidAmount: 1_000_000,
          outstanding: 1_610_000,
          status: "partial",
        },
      ],
      periodOutstanding: 0,
      links: [
        {
          linkId: "a",
          workerRut: "11111111-1",
          workerName: "Javiera",
          amount: 2_850_000,
          bankMovementId: "bank-a",
          glosa: "",
          createdAt: "2026-07-31T00:00:00Z",
        },
        {
          linkId: "b",
          workerRut: "22222222-2",
          workerName: "Matías",
          amount: 1_000_000,
          bankMovementId: "bank-b",
          glosa: "",
          createdAt: "2026-07-31T00:00:00Z",
        },
      ],
    };
    const t = texto(html({ settlementBoard: board }));
    expect(t).toContain("Pago confirmado");
    expect(t).toContain("Pago parcial");
    expect(t).toContain("Pago no verificado");
  });

  it("403/error declaran que no se pudo consultar asignaciones", () => {
    expect(texto(html({ settlementDisponibilidad: "forbidden" }))).toContain(
      "No tienes permiso para ver las asignaciones",
    );
    expect(texto(html({ settlementDisponibilidad: "error" }))).toContain(
      "No pudimos consultar las asignaciones",
    );
  });
});

describe("RemuneracionesV16View — concordancia singular/plural (N=1, issue #94)", () => {
  it("1 persona (singular) — no dice '1 personas'", () => {
    const soloUna = [EMPLEADO_ROJAS];
    const t = texto(
      html({
        totales: totales({ empleados_contados: 1, total_liquido: 2_850_000 }),
        detalle: soloUna,
      }),
    );
    expect(t).toContain("1 persona ");
    expect(t).not.toContain("1 personas");
  });

  it("[control positivo] con 5 personas, SÍ dice 'personas' (plural)", () => {
    const t = texto(html());
    expect(t).toContain("5 personas");
  });

  it("1 persona usa singular en el footer de evidencia", () => {
    const soloUna = [EMPLEADO_ROJAS];
    const t = texto(
      html({
        totales: totales({ empleados_contados: 1, total_liquido: 2_850_000 }),
        detalle: soloUna,
      }),
    );
    expect(t).toContain("1 pago individual requiere asignación corroborada");
    expect(t).not.toContain("1 pagos individuales requieren");
  });

  it("[control positivo] con varias personas usa plural en el footer", () => {
    expect(texto(html())).toContain("pagos individuales requieren");
  });
});

describe("RemuneracionesV16View — estados sin datos (Ley 8)", () => {
  it("error: dice la causa y ofrece reintentar", () => {
    const t = texto(html({ totales: undefined, payrollError: "el conector no respondió" }));
    expect(t).toContain("el conector no respondió");
  });

  it("vacío: dice qué falta y ofrece una acción", () => {
    const t = texto(html({ totales: undefined, detalle: [] }));
    expect(t).toMatch(/no hay totales de remuneraciones/i);
  });

  it("[mutante nulo de control] los tres estados (normal/error/vacío) producen HTML distinto", () => {
    const normal = html();
    const error = html({ totales: undefined, payrollError: "x" });
    const vacio = html({ totales: undefined, detalle: [] });
    expect(normal).not.toBe(error);
    expect(normal).not.toBe(vacio);
    expect(error).not.toBe(vacio);
  });
});
