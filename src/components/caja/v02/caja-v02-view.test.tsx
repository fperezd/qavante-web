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
 * El mock PRESERVA EL SIGNO del monto real (remanente #82.1): un sentinel que siempre pisa con un
 * valor positivo no puede, por construcción, renderizar nunca un Hoy negativo — el test "un saldo
 * de HOY negativo no agrega un segundo rojo" quedaba probando otra cosa (el conteo de rojos, no el
 * signo). Con el signo preservado, `${MINUS}$123.456.789` SÍ aparece en pantalla cuando el summary
 * trae un total negativo, y el mutante que vuelve a pisar el signo (ver el PR) muere en ESTE test.
 *
 * Cada negativo va con su gemelo positivo sobre el MISMO valor. */

const SENTINEL = 123_456_789;
// Signo menos tipográfico (U+2212) de `formatClp`; no un guion.
const MINUS = "−";

vi.mock("@/lib/finanzas/caja-hoy", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/finanzas/caja-hoy")>();
  return {
    ...real,
    cajaHoy: (s: Parameters<typeof real.cajaHoy>[0]) => {
      const original = real.cajaHoy(s);
      // Conserva el signo de la fuente real: el sentinel sólo reemplaza la magnitud.
      return original.monto == null
        ? original
        : { ...original, monto: Math.sign(original.monto) * SENTINEL };
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
      onPostpone={async () => undefined}
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

  it('apellido de "Sale": declara que due_14d incluye lo YA vencido (remanente #82.3)', () => {
    const t = texto(html());
    expect(t).toContain("incluye lo ya vencido");
  });

  it("items al tope del backend → el copy declara el recorte (remanente #82.4)", () => {
    const cien = Array.from({ length: 100 }, (_, i) => ({
      label: `Proveedor ${i + 1}`,
      category: "supplier" as const,
      due_date: "2026-09-05",
      amount: "10000",
      criticality: "low" as const,
      source: "SII",
      currency: "CLP",
    }));
    const t = texto(html({ pagos: pagos({ items: cien }) }));
    expect(t).toContain("primeros 100 pagos por vencer");
    // Gemelo: bajo el tope, el copy no declara ningún recorte.
    expect(texto(html())).not.toContain("puede haber más");
  });

  it("muestra la calidad del dato como auditoría secundaria, no como CTA de clasificación", () => {
    const h = html();
    const t = texto(h);
    expect(t).toContain("Calidad del dato:");
    expect(t).toContain("3 movimientos del banco sin clasificar (~$2.100.000 en entradas)");
    expect(t).toContain("Están en tu saldo; revisarlos puede mejorar el detalle del flujo.");
    expect(t).toContain("Ver auditoría");
    expect(h).toContain('href="/bandeja"');
    expect(h).not.toContain('href="/caja/por-clasificar"');
    expect(h).not.toMatch(/<a[^>]*>Clasificar<\/a>/);
    // Gemelo: sin pendientes el banner no está.
    expect(
      texto(html({ sinClasificar: sinClasificar({ count: 0, inflowByCurrency: [] }) })),
    ).not.toContain("sin clasificar");
  });

  it('sin-clasificar en ERROR: el banner NO desaparece, dice "no sé" en vez de un $0 falso (remanente #82.5)', () => {
    const h = html({
      sinClasificar: sinClasificar({ isError: true, count: 0, inflowByCurrency: [] }),
    });
    const t = texto(h);
    expect(h).toContain('role="note"');
    expect(t).toContain("No pudimos revisar la calidad de tus datos");
    expect(t).toContain("puede faltar detalle de movimientos del banco");
    // Gemelo: el mismo count=0 SIN error apaga el banner del todo (no es que "error" siempre
    // muestre algo — es el count=0 real el que lo apaga, y el error el que lo prende de nuevo).
    expect(
      texto(
        html({ sinClasificar: sinClasificar({ isError: false, count: 0, inflowByCurrency: [] }) }),
      ),
    ).not.toContain("No pudimos revisar la calidad de tus datos");
  });

  it("4 barras con neto por semana y cierre; la del piso está marcada", () => {
    const h = html();
    expect(h.match(/data-piso="true"/g)).toHaveLength(1);
    const t = texto(h);
    expect(t).toContain("+$3,4M");
    expect(t).toContain("−$9,6M");
    expect(t).toContain("cierra en −$1.121.250");
  });

  it("tabla: las causas del quiebre con fecha, estado y monto; Postergar sólo con UUID seguro", () => {
    const h = html();
    const t = texto(h);
    expect(t).toContain("Qué te lleva al punto más bajo · 7 sep · −$1.121.250");
    expect(t).toContain("Tradolarpeso");
    expect(t).toContain("vence 7 sep · pago");
    expect(t).toContain("−$674.473");
    expect(t).toContain("No se posterga"); // Ley 9: el F29
    expect(t).toContain("Vencido");
    expect((h.match(/href="\/pagar"/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((h.match(/data-postergar="true"/g) ?? []).length).toBe(3);
    expect(t).toContain("causas sin identidad segura se gestionan desde Pagar");
  });

  it("con Brief activo deja la proyección como evidencia sin proponer postergar ni clasificar", () => {
    const h = html({ suppressRecommendations: true });
    const t = texto(h);

    expect(t).toContain("Pagos registrados en la proyección");
    expect(t).toContain("respaldan la decisión de caja");
    expect(t).toContain("pagos comprometidos en los próximos 14 días");
    expect(t).not.toContain("negociable en 0-14 días");
    expect(t).not.toContain("No se posterga");
    expect(t).not.toContain("Postergar mueve la fecha");
    expect(h).not.toContain('data-postergar="true"');
    expect(h).not.toContain('href="/pagar"');

    /* Gemelos con la MISMA cadena sobre el render sin supresión: si mañana el
       texto cambia, las tres ausencias de arriba dejarían de medir nada y este
       bloque falla primero. */
    const conPlanLocal = texto(html());
    expect(conPlanLocal).toContain("negociable en 0-14 días");
    expect(conPlanLocal).toContain("No se posterga");
    expect(conPlanLocal).toContain("Postergar mueve la fecha");
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
    const h = html({ summary: s });
    // El Hoy RENDERIZADO es negativo de verdad (el mock preserva el signo): sin esto el test de
    // abajo pasaría igual con un Hoy positivo, y el nombre prometería más de lo que mide.
    const t = texto(h);
    expect(t).toContain(`${MINUS}$123.456.789`);
    expect(rojos(h)).toBe(1);
  });

  it("gemelo: el mismo summary con Hoy POSITIVO también deja exactamente un rojo (el piso)", () => {
    // Mismo caso que arriba, sin el signo negativo: confirma que "un rojo" no depende del signo
    // de Hoy, sino sólo del piso — así el test de arriba no es un contador que siempre da 1.
    expect(rojos(html())).toBe(1);
    expect(texto(html())).toContain("$123.456.789");
    expect(texto(html())).not.toContain(`${MINUS}$123.456.789`);
  });
});
