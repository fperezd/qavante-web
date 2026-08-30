import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { PagarV05View } from "./pagar-v05-view";
import {
  HOY,
  pagos,
  pagosConDuplicado,
  pagosDegradados,
  pagosSoloImpuestosYSueldos,
  pagosVacio,
} from "./pagar-v05-fixtures";

/* V05 · Pagar — la vista, renderizada de verdad (react-dom/server, sin browser).
 *
 * Lo que se fija acá se fija sobre el HTML: la Ley 2 se CUENTA (elementos con token rojo) y se
 * verifica QUIÉN lleva el rojo — la pill del duplicado o el relativo de la fila crítica, nunca
 * los dos. El "no sé" se busca como texto con su gemelo positivo. Las interacciones (filtros,
 * período, popovers) viven en las stories. */

function html(props: Partial<ComponentProps<typeof PagarV05View>> = {}): string {
  return renderToStaticMarkup(
    <PagarV05View pagos={pagos()} hoy={HOY} issueSucesor="#88" {...props} />,
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

/** El contenido del único elemento con token rojo. */
function elRojo(h: string): string {
  const m = /class="[^"]*(?:rediseno-rojo|danger-)[^"]*"[^>]*>([^<]*)</.exec(h);
  return m?.[1] ?? "";
}

describe("PagarV05View — tríada (caso normal)", () => {
  it("Vencido con su apellido: 3 pagos, el más antiguo hace 545 días — y NO va en rojo", () => {
    const h = html();
    const t = texto(h);
    expect(t).toContain("Vencido $8.729.650");
    expect(t).toContain("3 pagos · el más antiguo, 545 días");
    // El HTML de referencia pinta este KPI rojo; la spec (Ley 2) manda: acá va en tinta.
    expect(h).not.toMatch(/class="[^"]*rediseno-rojo[^"]*"[^>]*>\s*\$8\.729\.650/);
  });

  it("Por pagar · 14 días es el número del BACKEND, no la suma de la tabla", () => {
    const t = texto(html());
    expect(t).toContain("Por pagar 14 días $17.998.105");
    expect(t).toContain("incluye lo vencido");
    /* Contrato "en desacuerdo": si el backend publica otro tramo, se muestra ESE (Ley 1: el mismo
       número que "Sale · 14 días" en Caja), no lo que sume la tabla. */
    const raro = texto(html({ pagos: pagos({ due_14d: "12345678" }) }));
    expect(raro).toContain("$12.345.678");
    expect(raro).not.toContain("$17.998.105");
  });

  it("Crítico vs. caja: $8.078.055 contra $5.200.000 → faltan $2.878.055 aun postergando", () => {
    const t = texto(html());
    expect(t).toContain("Crítico vs. caja $8.078.055");
    expect(t).toContain("3 pagos que no se postergan en 14 días");
    expect(t).toContain(
      "caja proyectada $5.200.000: faltan $2.878.055 aun postergando lo negociable",
    );
  });

  it("banner de postergables → la decisión vive en Hoy (link a /), sin ejecución masiva acá", () => {
    const h = html();
    expect(texto(h)).toContain("$1.190.400 de lo que vence en 14 días es negociable");
    expect(texto(h)).toContain("La decisión de qué postergar vive en Hoy");
    expect(h).toContain('href="/"');
    // Gemelo: sin nada postergable el banner no está.
    expect(texto(html({ pagos: pagosSoloImpuestosYSueldos() }))).not.toContain("es negociable");
  });
});

describe("PagarV05View — tabla y footer", () => {
  it("orden por urgencia, proveedor completo, vence absoluto + relativo, USD en su moneda", () => {
    const t = texto(html());
    expect(t).toContain("Inmobiliaria Vista Kennedy SpA");
    expect(t).toContain("3 mar 2025 · hace 545 días");
    expect(t).toContain("Remuneraciones: Agosto 2026");
    expect(t).toContain("4 sep · en 5 días");
    expect(t).toMatch(/US\$\s1\.240,00/);
    expect(t).toContain("$1.190.400 al tipo de cambio");
    // El primero de la tabla es el más vencido.
    expect(t.indexOf("Inmobiliaria Vista Kennedy")).toBeLessThan(t.indexOf("Chipax SpA"));
  });

  it("pills: Negociable / Crédito / No se posterga — y NO existe la pill Servicio (hueco declarado)", () => {
    const t = texto(html());
    expect(t).toContain("Negociable");
    expect(t).toContain("Crédito");
    expect(t).toContain("No se posterga");
    // Ninguna pill dice "Servicio" (la única mención es el hueco declarado, entre comillas).
    expect(html()).not.toMatch(/>Servicio</);
    expect(t).toContain("la pill “Servicio” de la spec no se produce");
  });

  it("NO existe un botón 'pagar todo' (Ley 9), y el texto fijo de la ley está literal", () => {
    const h = html();
    // Ningún botón ni link "Pagar todo" en el DOM (la única mención es la declaración de que NO existe).
    expect(h).not.toMatch(/<(button|a)\b[^>]*>[^<]*[Pp]agar todo/);
    expect(texto(h)).toContain("No existe un botón “pagar todo”");
    expect(texto(h)).toContain("Impuestos y sueldos jamás entran en postergaciones automáticas.");
    expect(h).not.toContain(">Pagar todo<");
  });

  it("footer con el total del backend y el desglose por moneda (INV-FX-001)", () => {
    const t = texto(html());
    expect(t).toContain("Total por pagar $19.205.210 convertido a pesos");
    expect(t).toMatch(/por moneda: \$18\.014\.810 \(CLP\) \+ US\$\s1\.240,00 \(USD\)/);
  });
});

describe("PagarV05View — Ley 2: máximo un rojo por pantalla", () => {
  it("caso normal: EXACTAMENTE un rojo, y es el relativo de la fila crítica más urgente (Banco BICE)", () => {
    const h = html();
    expect(rojos(h)).toBe(1);
    expect(elRojo(h)).toBe("en 2 días");
  });

  it("con un posible duplicado: EXACTAMENTE un rojo, y es la pill Revisar — la fila crítica ya no lo lleva", () => {
    const h = html({ pagos: pagosConDuplicado() });
    expect(rojos(h)).toBe(1);
    expect(elRojo(h)).toBe("Revisar");
    // El otro duplicado va en ámbar con la misma palabra (dos "Revisar", un solo rojo).
    expect((texto(h).match(/Revisar/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // Gemelo del negativo: la MISMA query que en el caso normal ya no encuentra la fecha en rojo.
    expect(elRojo(h)).not.toBe("en 2 días");
    expect(texto(h)).toContain(
      "posible duplicado de Factura 9017 (vence 27 ago, $205.000): mismo RUT, monto a ±1 % y a 15 días",
    );
  });

  it("sin datos o sin respuesta: ningún rojo", () => {
    expect(rojos(html({ pagos: pagosVacio() }))).toBe(0);
    expect(rojos(html({ pagos: null }))).toBe(0);
  });
});

describe("PagarV05View — el 'no sé' explícito", () => {
  it("fila sin fecha → 'sin fecha', nunca 'hoy' ni 0 días; y lo sin fecha del backend se declara", () => {
    const t = texto(html({ pagos: pagosDegradados() }));
    expect(t).toContain("sin fecha");
    expect(t).toContain("3 documentos por $2.450.000 sin fecha, en ningún tramo");
    expect(t).not.toContain("hace 0 días");
    // La fila sin fecha no dice "hoy" (el gemelo positivo de "hoy" vive en el model test).
    expect(t).not.toMatch(/Aguas Cordillera S\.A\.[^·]*· hoy/);
  });

  it("caja proyectada en USD: no se compara con pesos, y se dice", () => {
    const t = texto(html({ pagos: pagosDegradados() }));
    expect(t).toContain(
      "la caja proyectada viene en USD y lo crítico está en pesos: no se comparan",
    );
    expect(t).not.toContain("faltan $");
  });

  it("USD sin tipo de cambio: fuera del total, declarado en la fila y en el footer", () => {
    const t = texto(html({ pagos: pagosDegradados() }));
    expect(t).toContain("sin tipo de cambio: no se suma como pesos");
    expect(t).toContain("1 pago en otra moneda sin tipo de cambio, fuera del total");
  });

  it("vacío: dice qué falta (Conectar SII) y ofrece qué hacer", () => {
    const t = texto(html({ pagos: pagosVacio() }));
    expect(t).toContain("No hay pagos por pagar");
    expect(t).toContain("Falta: Conectar SII.");
    expect(t).toContain("Revisar conexiones");
  });

  it("sin respuesta: la pantalla está ciega, no vacía", () => {
    const t = texto(html({ pagos: null, pagosMotivo: "No pudimos conectar (error de red)." }));
    expect(t).toContain("No pudimos consultar las cuentas por pagar");
    expect(t).toContain("error de red");
  });
});
