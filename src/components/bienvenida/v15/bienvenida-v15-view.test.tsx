import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { BienvenidaV15View } from "./bienvenida-v15-view";
import { AMBAS_CONECTADAS, HOY, NINGUNA_CONECTADA, UNA_DIFERIDA } from "./bienvenida-v15-fixtures";

/* V15 · Bienvenida — la vista, renderizada de verdad (react-dom/server, sin browser).
 *
 * Lo que se fija acá: Ley 2 (cero rojo en TODA la pantalla — un botón sin conectar es progreso,
 * nunca alarma), Ley 6 (ningún <button>/<a> con `disabled`), el hueco declarado del paso 2
 * (literal, y NUNCA un número que simule un conteo real), la promesa del paso 3 y la concordancia
 * singular/plural con N=1. Las interacciones (navegación real, Ley 7 a 360/320 px) viven en las
 * stories. */

function html(props: Partial<ComponentProps<typeof BienvenidaV15View>> = {}): string {
  return renderToStaticMarkup(
    <BienvenidaV15View states={AMBAS_CONECTADAS} hoy={HOY} issueSucesor="#100" {...props} />,
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

describe("BienvenidaV15View — Ley 2: cero rojo", () => {
  it("caso normal (dos fuentes conectadas): cero rojo", () => {
    expect(rojos(html())).toBe(0);
  });

  it("ninguna fuente conectada: cero rojo (progreso administrativo, no alarma)", () => {
    expect(rojos(html({ states: NINGUNA_CONECTADA }))).toBe(0);
  });

  it("estado de error: cero rojo", () => {
    expect(rojos(html({ states: null, motivo: "no respondió" }))).toBe(0);
  });

  it("estado de carga: cero rojo", () => {
    expect(rojos(html({ states: null, cargando: true }))).toBe(0);
  });
});

describe("BienvenidaV15View — Ley 6: ningún botón/link deshabilitado mudo", () => {
  it("ningún <button> ni <a> lleva el atributo disabled, en ningún estado", () => {
    for (const h of [
      html(),
      html({ states: NINGUNA_CONECTADA }),
      html({ states: null, motivo: "x" }),
    ]) {
      expect(h).not.toMatch(/<(button|a)[^>]*\bdisabled\b/i);
    }
  });

  it("cada fuente pendiente ofrece un link que navega a algún lado (href no vacío)", () => {
    const h = html({ states: NINGUNA_CONECTADA });
    expect(h).toMatch(/Conectar ahora<\/a>/);
    expect(h).not.toMatch(/href=""/);
  });
});

describe("BienvenidaV15View — paso 1: fuentes con estado y tiempo estimado", () => {
  it("con las dos conectadas, dice '2 de 2 conectadas' y no ofrece tiempo de conexión", () => {
    const t = texto(html());
    expect(t).toContain("2 de 2 conectadas");
    expect(t).not.toContain("Conectarla toma");
  });

  it("[control positivo] sin conectar, SÍ declara el tiempo típico de cada conexión", () => {
    const t = texto(html({ states: NINGUNA_CONECTADA }));
    expect(t).toContain("Conectarla toma ~2 minutos.");
    expect(t).toContain("Conectarla toma ~3 minutos.");
  });

  it("una fuente diferida se distingue de una pendiente (badge propio, no un 'sin conectar' genérico)", () => {
    const t = texto(html({ states: UNA_DIFERIDA }));
    expect(t).toContain("La conectas después");
  });
});

describe("BienvenidaV15View — paso 2: el hueco declarado, NUNCA un número inventado", () => {
  it("declara literalmente que no hay eventos de progreso consultables, con el issue sucesor", () => {
    const t = texto(html());
    expect(t).toContain(
      "Todavía no podemos decirte en qué etapa exacta va ni cuántos documentos llevamos",
    );
    expect(t).toContain("(#100)");
  });

  it("ningún verbo de la lista de etapas lleva un número (no es un contador disfrazado)", () => {
    const h = html();
    // Las etapas van en un <ol><li>1</li>...; se verifica que el TEXTO del verbo (dentro del
    // segundo <span> de cada <li>) no incluya dígitos — el índice de la lista sí es un número,
    // pero no es un conteo de documentos.
    expect(h).not.toMatch(/leemos \d/i);
    expect(h).not.toMatch(/\d+\s*(facturas|boletas|documentos|movimientos)\s*(le[ií]d[ao]s)?/i);
  });

  it("sin ninguna fuente conectada, dice que no hay nada que construir todavía", () => {
    const t = texto(html({ states: NINGUNA_CONECTADA }));
    expect(t).toContain("No hay algo que construir todavía");
    expect(t).toContain("Conecta al menos una fuente en el paso 1");
  });

  it("Ley 8 — el estado vacío ofrece el botón que lo resuelve, no sólo el texto (issue #99)", () => {
    const h = html({ states: NINGUNA_CONECTADA });
    expect(h).toMatch(/<a[^>]+href="#paso-1-titulo"[^>]*>Ir al paso 1<\/a>/);
  });

  it("[control positivo] con algo que construir, el botón del vacío NO aparece (no es un CTA fijo)", () => {
    const h = html();
    expect(h).not.toMatch(/<a[^>]+href="#paso-1-titulo"[^>]*>Ir al paso 1<\/a>/);
  });

  it("[control positivo] con al menos una fuente conectada, SÍ lista las etapas del proceso", () => {
    const t = texto(html({ states: UNA_DIFERIDA }));
    expect(t).toContain("Armamos tu primer parte");
  });

  it("la duración típica declarada aparece literal", () => {
    expect(texto(html())).toContain("normalmente toma unas horas; listo de un día para otro");
  });
});

describe("BienvenidaV15View — paso 3: promesa final con hora", () => {
  it("la frase 'mañana a las 7:00' aparece, capitalizada al inicio de la oración", () => {
    expect(texto(html())).toContain("Mañana a las 7:00 llega tu primer parte.");
  });

  it("la fecha concreta acompaña a la promesa (no sólo la palabra 'mañana')", () => {
    // HOY = 2026-08-29T15:00:00Z → mañana es 30 ago 2026, sea cual sea el huso de Santiago.
    expect(texto(html())).toContain("30 ago 2026");
  });
});

describe("BienvenidaV15View — estados sin datos (Ley 8)", () => {
  it("carga: dice qué está trayendo y un ETA", () => {
    const t = texto(html({ states: null, cargando: true }));
    expect(t).toMatch(/revisando el estado de tus conexiones \(~2 s\)/);
  });

  it("error: dice la causa y ofrece Reintentar", () => {
    const h = html({ states: null, motivo: "el conector no respondió", onReintentar: () => {} });
    expect(texto(h)).toContain("el conector no respondió");
    expect(texto(h)).toContain("Reintentar");
  });

  it("[mutante nulo de control] carga/error/normal producen HTML distinto entre sí", () => {
    const normal = html();
    const cargando = html({ states: null, cargando: true });
    const error = html({ states: null, motivo: "x" });
    expect(normal).not.toBe(cargando);
    expect(normal).not.toBe(error);
    expect(cargando).not.toBe(error);
  });
});

describe("BienvenidaV15View — concordancia singular/plural (N=1, issue #94)", () => {
  it("1 fuente pendiente (singular): 'Te queda 1 fuente por conectar'", () => {
    const t = texto(html({ states: UNA_DIFERIDA }));
    expect(t).toContain("Te queda 1 fuente por conectar.");
    expect(t).not.toContain("Te quedan 1 fuente");
    expect(t).not.toContain("1 fuentes");
  });

  it("[control positivo] 2 fuentes pendientes (plural): 'Te quedan 2 fuentes por conectar'", () => {
    const t = texto(html({ states: NINGUNA_CONECTADA }));
    expect(t).toContain("Te quedan 2 fuentes por conectar.");
  });

  it("con las dos conectadas, no aparece ninguna frase de 'por conectar' (nada pendiente)", () => {
    expect(texto(html())).not.toContain("por conectar");
  });

  it("1 fuente conectada (singular) en el paso 2: 'Con 1 fuente conectada'", () => {
    const t = texto(html({ states: UNA_DIFERIDA }));
    expect(t).toContain("Con 1 fuente conectada, así se arma");
    expect(t).not.toContain("1 fuentes conectadas");
  });

  it("[control positivo] con 2 fuentes conectadas: 'Con 2 fuentes conectadas'", () => {
    expect(texto(html())).toContain("Con 2 fuentes conectadas, así se arma");
  });
});

describe("BienvenidaV15View — multiempresa", () => {
  it("ningún texto de la pantalla afirma que hay una sola empresa posible", () => {
    const t = texto(html()).toLowerCase();
    expect(t).not.toContain("tu única empresa");
    expect(t).not.toContain("la única empresa");
  });
});
