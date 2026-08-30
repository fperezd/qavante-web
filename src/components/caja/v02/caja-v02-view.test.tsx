import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CajaV02View } from "./caja-v02-view";
import type { ComponentProps } from "react";
import {
  HOY,
  PROYECCION_BAJO_CERO,
  cobranza,
  pagos,
  proyeccion,
  sinClasificar,
  summary,
} from "./caja-v02-fixtures";

/* V02 · Caja — la vista, renderizada de verdad (react-dom/server, sin browser).
 *
 * LEY 1 con un SENTINEL: `cajaHoy` se mockea para devolver un saldo que NO está en el summary
 * (el summary dice $9.800.000; la fuente única dice $123.456.789). Si la vista lee `cash_today`
 * por su cuenta, renderiza $9.800.000 y este test se cae. Un test que sólo comparara
 * `formatClp(cajaHoy(summary))` contra el DOM pasaría con las DOS implementaciones —sería un
 * ratchet textual esquivable— porque ambas dan el mismo número sobre el mismo summary.
 *
 * Cada negativo va con su gemelo positivo sobre el MISMO valor. */

const SENTINEL = 123_456_789;

vi.mock("@/lib/finanzas/caja-hoy", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/finanzas/caja-hoy")>();
  return {
    ...real,
    cajaHoy: (s: Parameters<typeof real.cajaHoy>[0]) => {
      const original = real.cajaHoy(s);
      // Sólo cuando hay saldo: el caso "sin dato" tiene que seguir siendo null.
      return original.monto == null ? original : { ...original, monto: SENTINEL };
    },
  };
});

function html(props: Partial<ComponentProps<typeof CajaV02View>> = {}): string {
  return renderToStaticMarkup(
    <CajaV02View
      summary={summary()}
      proyeccion={PROYECCION_BAJO_CERO}
      cobranza={cobranza()}
      pagos={pagos()}
      sinClasificar={sinClasificar()}
      bancos={["BICE"]}
      hoy={HOY}
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

describe("CajaV02View — Ley 1: el KPI Hoy lee de cajaHoy() y de ningún otro lado", () => {
  it("renderiza el SENTINEL de la fuente única, no el cash_today del summary", () => {
    const t = texto(html());
    expect(t).toContain("$123.456.789");
    // Gemelo: el número que el summary trae crudo NO aparece en pantalla.
    expect(t).not.toContain("$9.800.000");
    expect(summary().cash_today!.total).toBe("9800000");
  });

  it("chip con banco + hora + ✓ y el apellido de la cifra", () => {
    const t = texto(html());
    expect(t).toMatch(/BICE · \d{2}:\d{2} ✓/);
    expect(t).toContain("el mismo número que en Hoy");
  });

  it('sin cash_today → "sin dato" con motivo, nunca "$0"', () => {
    const t = texto(html({ summary: summary({ cash_today: null }) }));
    expect(t).toContain("sin dato");
    expect(t).toContain("Conecta tu banco para ver tu saldo real");
    expect(t).not.toContain("$0 ");
    expect(t).not.toContain("$123.456.789");
  });
});

describe("CajaV02View — tríada, banner, barras, tabla y footer", () => {
  it("Entra 14d y Sale 14d con su postergable, con signos y menos tipográfico", () => {
    const t = texto(html());
    expect(t).toContain("+$14.498.964");
    expect(t).toContain("−$35.532.396");
    expect(t).toContain("$1.000.000 negociable");
  });

  it("banner de deuda de datos con conteo y monto por moneda, y CTA al flujo actual (no /bandeja)", () => {
    const h = html();
    const t = texto(h);
    expect(t).toContain("3 movimientos del banco sin clasificar (~$2.100.000 en entradas)");
    expect(h).toContain('href="/caja/por-clasificar"');
    expect(h).not.toContain('href="/bandeja"');
    // Gemelo: sin pendientes el banner no está.
    expect(
      texto(html({ sinClasificar: sinClasificar({ count: 0, inflowByCurrency: [] }) })),
    ).not.toContain("sin clasificar");
  });

  it("4 barras con neto por semana y cierre; la del piso está marcada", () => {
    const h = html();
    expect(h.match(/data-piso="true"/g)).toHaveLength(1);
    const t = texto(h);
    expect(t).toContain("+$3,4M");
    expect(t).toContain("−$9,6M");
    expect(t).toContain("cierra en −$1.121.250");
  });

  it("tabla: las causas del quiebre con fecha, estado y monto; Pagar por fila; el hueco declarado", () => {
    const h = html();
    const t = texto(h);
    expect(t).toContain("Qué te lleva al punto más bajo · 7 sep · −$1.121.250");
    expect(t).toContain("Tradolarpeso");
    expect(t).toContain("vence 7 sep · pago");
    expect(t).toContain("−$674.473");
    expect(t).toContain("No se posterga"); // Ley 9: el F29
    expect(t).toContain("Vencido");
    expect((h.match(/href="\/pagar"/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(t).toContain("Postergar ▾ (7/15/30 días) todavía no está");
  });

  it("footer con las exclusiones y su conteo", () => {
    const t = texto(html());
    expect(t).toContain("No cuenta $39.600.000 por cobrar vencidos o sin fecha (17 documentos)");
    expect(t).toContain("3 de 12 obligaciones van con fecha estimada");
  });

  it("sin proyección: estado que habla (qué falta y qué hacer), sin barras ni piso", () => {
    const h = html({ proyeccion: null, summary: summary({ cash_today: null }) });
    const t = texto(h);
    expect(t).toContain("No pudimos consultar la proyección de caja");
    expect(t).toContain("no proyectamos una curva desde $0");
    expect(t).toContain("Revisar conexiones");
    expect(h).not.toContain("data-piso");
    expect(t).not.toContain("Qué te lleva al punto más bajo");
    expect(t).toContain("Sin proyección no hay exclusiones que declarar");
  });
});

describe("CajaV02View — Ley 2: máximo un rojo por pantalla", () => {
  it("con el mínimo bajo cero hay EXACTAMENTE un elemento rojo: la barra del piso", () => {
    const h = html();
    expect(rojos(h)).toBe(1);
    expect(h).toMatch(
      /class="[^"]*bg-rediseno-rojo[^"]*"[^>]*data-piso="true"|data-piso="true"[^>]*class="[^"]*bg-rediseno-rojo/,
    );
  });

  it("con el mínimo sobre cero no hay NINGÚN rojo, aunque haya vencidos y sin clasificar", () => {
    const h = html({
      proyeccion: proyeccion({ punto_quiebre: PROYECCION_BAJO_CERO.punto_quiebre }),
    });
    expect(rojos(h)).toBe(0);
    // Gemelo positivo: la misma query SÍ cuenta en el caso bajo cero (no es una regex que nunca casa).
    expect(rojos(html())).toBe(1);
  });

  it("un saldo de HOY negativo no agrega un segundo rojo (el piso ya lo es)", () => {
    const s = summary({
      cash_today: {
        total: "-1121250",
        last_updated: "2026-08-30T08:12:00Z",
        data_state: "available",
      },
    });
    expect(rojos(html({ summary: s }))).toBe(1);
  });
});
