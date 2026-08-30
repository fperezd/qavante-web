import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { BancoV03View } from "./banco-v03-view";
import {
  BANCO,
  HOY,
  SUMMARY_STALE,
  categorias,
  cuentasQavante,
  links,
  movimientos,
  saldoOk,
  saldoSesionVencida,
  saldoTarjetas,
  sourcesError,
  sourcesOk,
  sourcesSinConectar,
  sourcesSyncing,
  summary,
  tarjetasOk,
  tarjetasSesionVencida,
} from "./banco-v03-fixtures";

/* V03 · Banco — la vista, renderizada de verdad (react-dom/server, sin browser).
 *
 * LEY 1 con un SENTINEL: `cajaHoy` se mockea para devolver un saldo que NO está en el summary ni
 * en el banco (summary y banco dicen $9.800.000; la fuente única dice $123.456.789). Si la vista
 * lee `cash_today` por su cuenta, o suma los saldos del banco para el KPI, renderiza $9.800.000
 * como "Caja hoy" y este test se cae. Cada negativo va con su gemelo positivo sobre el MISMO valor. */

const SENTINEL = 123_456_789;

vi.mock("@/lib/finanzas/caja-hoy", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/finanzas/caja-hoy")>();
  return {
    ...real,
    cajaHoy: (s: Parameters<typeof real.cajaHoy>[0]) => {
      const original = real.cajaHoy(s);
      return original.monto == null ? original : { ...original, monto: SENTINEL };
    },
  };
});

function html(props: Partial<ComponentProps<typeof BancoV03View>> = {}): string {
  return renderToStaticMarkup(
    <BancoV03View
      summary={summary()}
      saldo={saldoOk()}
      tarjetas={tarjetasOk()}
      saldoPorTarjeta={saldoTarjetas()}
      cuentasQavante={cuentasQavante()}
      links={links()}
      sources={sourcesOk()}
      movimientos={movimientos()}
      movimientosTotal={8}
      categorias={categorias()}
      banco={BANCO}
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

/** Ley 2 — cuántos elementos llevan token rojo (los dos sistemas de tokens del repo). */
function rojos(h: string): number {
  return (h.match(/class="[^"]*(rediseno-rojo|danger-)[^"]*"/g) ?? []).length;
}
function ambares(h: string): number {
  return (h.match(/class="[^"]*rediseno-ambar[^"]*"/g) ?? []).length;
}

describe("BancoV03View — Ley 1: Caja hoy lee de cajaHoy() y de ningún otro lado", () => {
  it("renderiza el SENTINEL de la fuente única como Caja hoy", () => {
    const t = texto(html());
    expect(t).toContain("Caja hoy");
    expect(t).toContain("$123.456.789");
    expect(t).toContain("el mismo número que en Hoy y Caja");
  });

  it("el saldo del banco se muestra APARTE, con su apellido, y no reemplaza a Caja hoy", () => {
    const t = texto(html());
    // El banco informa $9.800.000 en la cuenta CLP: está en la tabla, bajo "Saldo contable".
    expect(t).toContain("Saldo contable");
    expect(t).toContain("$9.800.000");
    expect(t).toContain(
      "Saldo contable según el banco, por moneda: CLP $9.800.000 (1 cuenta) · USD US$ 1.240,00 (1 cuenta)",
    );
    // Y el KPI no lo tomó: el sentinel sigue siendo Caja hoy (gemelo del positivo de arriba).
    expect(t).toMatch(/Caja hoy .*\$123\.456\.789/);
  });

  it("chip con banco + frescura + ✓ cuando el saldo es de hoy; stale de hace dos días sin ✓ y con reparo", () => {
    expect(texto(html())).toContain("BICE · hoy ✓");
    const t = texto(html({ summary: SUMMARY_STALE }));
    expect(t).toContain("BICE · hace 2 días");
    expect(t).not.toContain("BICE · hace 2 días ✓");
    expect(t).toContain("Puede estar desactualizado");
  });

  it("sin cash_today → 'sin dato' con motivo, nunca $0", () => {
    const t = texto(html({ summary: summary({ cash_today: null }) }));
    expect(t).toContain("BICE · sin saldo");
    expect(t).toContain("sin dato");
    expect(t).not.toMatch(/Caja hoy[^$]*\$0\b/);
  });
});

describe("BancoV03View — estado de conexión: el 'no sé' es explícito", () => {
  it("normal: Conectada ✓ en cada fila, frescura + pendientes en el .sub", () => {
    const t = texto(html());
    expect(t).toContain("Conectada ✓");
    expect(t).toContain("actualizada hoy · 4 movimientos por conciliar");
    expect(t).toContain("BICE · Cuenta Corriente CLP ···67-8");
    expect(t).toContain("BICE · Tarjeta de Crédito USD ···3210");
    expect(t).toContain("−US$ 184,00");
  });

  it("la forma REAL con la sesión vencida: 'Tu acción' + banner con qué hacer, sin $0 y sin 'Conectada'", () => {
    const h = html({
      saldo: saldoSesionVencida(),
      tarjetas: tarjetasSesionVencida(),
      sources: sourcesError(),
      links: null,
    });
    const t = texto(h);
    expect(t).toContain("Tu acción");
    expect(t).toContain("Tu sesión con BICE no está disponible.");
    expect(t).toContain("Desde el 28 ago no llegan saldos ni movimientos nuevos");
    expect(t).toContain("Reconectar BICE");
    expect(t).toContain("desde el 28 ago no llegan movimientos");
    // Las cuentas siguen listadas (existen), sin saldo y con motivo.
    expect(t).toContain("BICE · Cuenta Corriente CLP");
    expect(t).toContain("s/d");
    expect(t).toContain("2 cuentas sin saldo informado");
    expect(t).not.toContain("Conectada ✓");
    expect(t).not.toContain("Saldo contable según el banco, por moneda: CLP $0");
    // Ley 2: ámbar sí, rojo NO.
    expect(ambares(h)).toBeGreaterThan(0);
    expect(rojos(h)).toBe(0);
  });

  it("sin dato de sources ni de bice → 'Sin dato de conexión', nunca 'Conectada ✓'", () => {
    const t = texto(html({ sources: null, saldo: null, tarjetas: null, links: null }));
    expect(t).toContain("Sin dato de conexión");
    expect(t).not.toContain("Conectada ✓");
    expect(t).toContain("sin dato de actualización");
  });

  it("actualizando → pill 'Actualizando' y ETA declarado", () => {
    const t = texto(html({ sources: sourcesSyncing(), saldo: null, tarjetas: null, links: null }));
    expect(t).toContain("Actualizando");
    expect(t).toContain("trayendo la cartola… listo en ~30 s");
  });

  it("sin banco conectado → estado vacío con la acción de conectar", () => {
    const t = texto(
      html({
        sources: sourcesSinConectar(),
        saldo: null,
        tarjetas: null,
        links: null,
        cuentasQavante: [],
      }),
    );
    expect(t).toContain("No hay cuentas de banco");
    expect(t).toContain("Conectar un banco");
  });
});

describe("BancoV03View — movimientos", () => {
  it("filtros con conteo, pill de ciclo de vida y CTA Clasificar con el ítem cargado", () => {
    const h = html();
    const t = texto(h);
    expect(t).toContain("Todos · 8");
    expect(t).toContain("Abonos · 3");
    expect(t).toContain("Cargos · 5");
    expect(t).toContain("Por conciliar · 5");
    expect(t).toContain("Conciliado ✓");
    expect(t).toContain("Clasificado ✓");
    expect(t).toContain("Por clasificar");
    expect(h).toContain('href="/caja/por-clasificar?movimiento=m3"');
    expect(h).not.toContain("/bandeja");
    // La glosa completa (Ley 7) y el .sub con fecha · cuenta · categoría.
    expect(t).toContain("Abono por transferencia de Cliente Norte SpA 76.123.456-7");
    expect(t).toContain("21 ago · CC CLP · Cobro de cliente");
    expect(t).toContain("+$6.000.000");
    expect(t).toContain("−$7.450.761");
  });

  it("'classified' sin categoría NO se pinta Clasificado ✓: cuenta 3 Clasificado/Conciliado y el resto por clasificar", () => {
    const t = texto(html());
    const conciliados = (t.match(/Conciliado ✓/g) ?? []).length;
    const clasificados = (t.match(/Clasificado ✓/g) ?? []).length;
    const porClasificar = (t.match(/Por clasificar/g) ?? []).length;
    expect(conciliados).toBe(2); // m1, m5
    expect(clasificados).toBe(2); // m2, m4
    expect(porClasificar).toBe(4); // m3, m6, m7, m8
  });

  it("totales del footer por moneda; el alcance se declara", () => {
    const t = texto(html({ movimientosTotal: 1200 }));
    expect(t).toContain("CLP : abonos $7.120.000 , cargos −$7.966.983 , neto −$846.983 (7)");
    expect(t).toContain("USD : abonos US$ 0,00 , cargos −US$ 184,00 , neto −US$ 184,00 (1)");
    expect(t).toContain("Mostrando 8 de 1200 en los últimos 3 meses");
  });

  it("sin movimientos → estado vacío que dice qué falta; error → causa", () => {
    expect(texto(html({ movimientos: [] }))).toContain("No hay movimientos del banco");
    expect(
      texto(html({ movimientos: null, movimientosMotivo: "La fuente X no respondió." })),
    ).toContain("La fuente X no respondió.");
  });
});

describe("BancoV03View — Ley 2: cero rojos en todos los estados", () => {
  it("normal, sin dato, actualizando y sesión vencida: 0 elementos con token rojo", () => {
    const casos = [
      html(),
      html({ sources: null, saldo: null, tarjetas: null, links: null }),
      html({ sources: sourcesSyncing(), saldo: null, tarjetas: null, links: null }),
      html({
        saldo: saldoSesionVencida(),
        tarjetas: tarjetasSesionVencida(),
        sources: sourcesError(),
      }),
      html({ movimientos: [] }),
    ];
    for (const h of casos) expect(rojos(h)).toBe(0);
    // Gemelo positivo del selector: la misma regex SÍ cuenta un rojo si lo hubiera.
    expect(rojos('<span class="text-rediseno-rojo">x</span>')).toBe(1);
    // Y la pantalla normal SÍ tiene ámbar (el pill "Por clasificar"): el cero no es una vista vacía.
    expect(ambares(html())).toBeGreaterThan(0);
  });
});

describe("BancoV03View — el nombre del banco no se hardcodea", () => {
  it("sin prop `banco`, sale del display_name de la fuente de banco", () => {
    const t = texto(html({ banco: undefined }));
    expect(t).toContain("Banco BICE · hoy ✓");
    expect(t).not.toContain("BICE · hoy ✓ BICE");
  });

  it("sin prop y sin fuente de banco → 'Banco' (neutro), nunca un proveedor inventado", () => {
    const t = texto(
      html({ banco: undefined, sources: null, saldo: null, tarjetas: null, links: null }),
    );
    // El chip del KPI y el pill de conexión salen con el nombre neutro; las filas de cuentas Qavante
    // siguen diciendo su `bank_name` (ése sí es dato, no un default).
    expect(t).toContain("Banco · hoy ✓");
    expect(t).not.toContain("BICE · hoy ✓");
    expect(t).toContain("Sin dato de conexión");
  });

  it("la prop manda cuando viene (las fixtures la pasan explícita)", () => {
    expect(texto(html())).toContain("BICE · hoy ✓");
  });
});
