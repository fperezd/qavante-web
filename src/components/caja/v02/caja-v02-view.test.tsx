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
  it("Entra 14d y Sale 14d con su agregado no postergable, con signos y menos tipográfico", () => {
    const t = texto(html());
    expect(t).toContain("+$14.498.964");
    expect(t).toContain("−$35.532.396");
    /* El agregado del servidor (`non_postponable_or_overdue_14d`), el MISMO que V05 publica como
       "Pagos críticos vencidos y próximos" (Ley 1). B10: el texto declara el alcance (vencidos de
       cualquier antigüedad + próximos en 14d) en vez de dejarlo leer como un desglose del total. */
    expect(t).toContain(
      "$7.574.979 críticos vencidos (cualquier antigüedad) y próximos en estos 14 días · 2 pagos críticos",
    );
  });

  it("B10 (QA real 2026-10-10): el crítico puede superar el total de Sale 14d sin que sea un error — el texto declara el alcance distinto", () => {
    /* Caso real: Sale 14 días mostraba −$69.123.556 mientras "pagos críticos" mostraba "al menos
       $73.386.764" — una cifra MAYOR que el total del que parecía ser desglose. No es un error de
       suma: `non_postponable_or_overdue_14d` cuenta TODO lo vencido (cualquier antigüedad), un
       universo más ancho que `due_14d`. La pantalla no reconcilia las dos cifras (sería inventar
       una resta que el servidor no publica, #302 P2-6): declara honestamente el alcance distinto. */
    const t = texto(
      html({
        pagos: pagos({
          due_14d: "69123556",
          non_postponable_or_overdue_14d: {
            amount_clp: null,
            known_amount_clp: "73386764",
            complete: false,
            count: 5,
            unknown_due_date_count: 2,
            excluded_by_currency: [],
          },
        }),
      }),
    );
    // El total de "Sale" sigue siendo el que publica due_14d.
    expect(t).toContain(`${MINUS}$69.123.556`);
    // El crítico, mayor, se muestra tal cual — nunca clampeado para no superar el total.
    expect(t).toContain("al menos $73.386.764 críticos vencidos (cualquier antigüedad)");
    // Y el texto declara por qué puede ser mayor, en vez de callarlo.
    expect(t).toContain("y próximos en estos 14 días");
  });

  it("no publica un negociable sumado desde los ítems de la página (#302 P2-6)", () => {
    const t = texto(html());
    /* Control negativo: Tradolarpeso + Vásquez (los dos "negociables" de la lista) suman
       $1.000.000; ese número no puede aparecer con ningún rótulo. */
    expect(t).not.toContain("$1.000.000");
    expect(t).not.toContain("negociable");
    // Gemelo: con el agregado ausente la pantalla lo declara en vez de aproximarlo.
    expect(texto(html({ pagos: pagos({ non_postponable_or_overdue_14d: undefined }) }))).toContain(
      "el agregado de pagos críticos no viene en esta respuesta",
    );
  });

  it("agregado parcial → 'al menos' con sus huecos declarados, nunca $0", () => {
    const t = texto(
      html({
        pagos: pagos({
          non_postponable_or_overdue_14d: {
            amount_clp: null,
            known_amount_clp: "174979",
            complete: false,
            count: 2,
            unknown_due_date_count: 1,
            excluded_by_currency: [{ currency: "USD", amount: "830", currency_status: "verified" }],
          },
        }),
      }),
    );
    expect(t).toContain(
      "al menos $174.979 críticos vencidos (cualquier antigüedad) y próximos en estos 14 días · 2 pagos críticos",
    );
    expect(t).not.toContain("$0 críticos");
  });

  it('apellido de "Sale": declara que due_14d incluye lo YA vencido (remanente #82.3)', () => {
    const t = texto(html());
    expect(t).toContain("Incluye lo vencido");
  });

  it("muestra la calidad del dato como auditoría secundaria, no como CTA de clasificación", () => {
    const h = html();
    const t = texto(h);
    expect(t).not.toContain("Calidad del dato:");
    expect(t).toContain("3 movimientos pendientes (~$2.100.000 en entradas)");
    expect(t).toContain("Revisar");
    expect(h).toContain('href="/bandeja"');
    expect(h).not.toContain('href="/caja/por-clasificar"');
    expect(h).not.toMatch(/<a[^>]*>Clasificar<\/a>/);
    // Gemelo: sin pendientes el banner no está.
    expect(
      texto(html({ sinClasificar: sinClasificar({ count: 0, inflowByCurrency: [] }) })),
    ).not.toContain("sin clasificar");
  });

  it("B11 (QA real 2026-10-10): con entradas Y salidas pendientes, el aviso nombra las DOS direcciones", () => {
    /* Caso real: "11 movimientos pendientes (~$38.512.299 · US$ 5.862,30 en entradas)" callaba
       que 3 de esos 11 eran salidas por $313.040. Ninguna dirección se omite cuando la otra
       está presente. */
    const t = texto(
      html({
        sinClasificar: sinClasificar({
          count: 11,
          inflowByCurrency: [
            { currency: "CLP", inflow: 38_512_299, count: 7 },
            { currency: "USD", inflow: 5862.3, count: 1 },
          ],
          outflowByCurrency: [{ currency: "CLP", outflow: 313_040, count: 3 }],
        }),
      }),
    );
    expect(t).toContain("en entradas");
    expect(t).toContain("$313.040 en salidas");
    // Gemelo: solo entradas (sin salidas pendientes) no inventa un "en salidas".
    const soloEntradas = texto(
      html({
        sinClasificar: sinClasificar({
          count: 7,
          inflowByCurrency: [{ currency: "CLP", inflow: 38_512_299, count: 7 }],
          outflowByCurrency: [],
        }),
      }),
    );
    expect(soloEntradas).not.toContain("en salidas");
  });

  it('sin-clasificar en ERROR: el banner NO desaparece, dice "no sé" en vez de un $0 falso (remanente #82.5)', () => {
    const h = html({
      sinClasificar: sinClasificar({ isError: true, count: 0, inflowByCurrency: [] }),
    });
    const t = texto(h);
    expect(h).toContain('role="note"');
    expect(t).toContain("Faltan movimientos del banco.");
    // Gemelo: el mismo count=0 SIN error apaga el banner del todo (no es que "error" siempre
    // muestre algo — es el count=0 real el que lo apaga, y el error el que lo prende de nuevo).
    expect(
      texto(
        html({ sinClasificar: sinClasificar({ isError: false, count: 0, inflowByCurrency: [] }) }),
      ),
    ).not.toContain("Faltan movimientos del banco.");
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
    expect(t).not.toContain("causas sin identidad segura se gestionan desde Pagar");
  });

  it("con Brief activo deja la proyección como evidencia sin proponer postergar ni clasificar", () => {
    const h = html({ suppressRecommendations: true });
    const t = texto(h);

    expect(t).toContain("Pagos registrados en la proyección");
    expect(t).not.toContain("respaldan la decisión de caja");
    /* El agregado del servidor es evidencia, no una decisión local: se conserva con el Brief. */
    expect(t).toContain("$7.574.979 críticos");
    expect(t).not.toContain("No se posterga");
    expect(t).not.toContain("Postergar mueve la fecha");
    expect(h).not.toContain('data-postergar="true"');
    expect(h).not.toContain('href="/pagar"');

    /* Gemelos con la MISMA cadena sobre el render sin supresión: si mañana el
       texto cambia, las dos ausencias de arriba dejarían de medir nada y este
       bloque falla primero. */
    const conPlanLocal = texto(html());
    expect(conPlanLocal).toContain("No se posterga");
    expect(conPlanLocal).not.toContain("Postergar mueve la fecha");
  });

  it("footer con las exclusiones y su conteo", () => {
    const t = texto(html());
    expect(t).not.toContain("No cuenta $39.600.000 por cobrar vencidos o sin fecha");
    expect(t).not.toContain("3 de 12 obligaciones van con fecha estimada");
  });

  it("sin proyección: estado que habla (qué falta y qué hacer), sin barras ni piso", () => {
    const h = html({ proyeccion: null, summary: summary({ cash_today: null }) });
    const t = texto(h);
    expect(t).toContain("No pudimos consultar la proyección de caja");
    expect(t).toContain("no proyectamos una curva desde $0");
    expect(t).toContain("Revisar conexiones");
    expect(h).not.toContain("data-piso");
    expect(t).not.toContain("Qué te lleva al punto más bajo");
    expect(t).not.toContain("Sin proyección no hay exclusiones que declarar");
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
