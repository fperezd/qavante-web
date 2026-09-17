import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { PagarV05View } from "./pagar-v05-view";
import {
  ANOMALIA_ENTEL,
  BICE,
  HOY,
  pagos,
  pagosAuditoriaD01,
  pagosConDuplicado,
  pagosConFechasEstimadas,
  pagosDegradados,
  pagosListaTopeadaSinCriticos,
  pagosSoloImpuestosYSueldos,
  pagosVacio,
  KENNEDY,
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
  it("Vencido usa el agregado global: 3 pagos en todo el registro — y NO va en rojo", () => {
    const h = html();
    const t = texto(h);
    expect(t).toContain("Vencido $8.729.650");
    expect(t).toContain("3 pagos en todo el registro");
    // El HTML de referencia pinta este KPI rojo; la spec (Ley 2) manda: acá va en tinta.
    expect(h).not.toMatch(/class="[^"]*rediseno-rojo[^"]*"[^>]*>\s*\$8\.729\.650/);
  });

  it("Vencido singular se obtiene del agregado global, no de la página", () => {
    const t = texto(
      html({
        pagos: pagos({
          items: [{ ...KENNEDY, due_date: "2026-08-29" }],
          overdue_summary: {
            amount_clp: "7078882",
            known_amount_clp: "7078882",
            complete: true,
            count: 1,
            unknown_due_date_count: 0,
            excluded_by_currency: [],
          },
        }),
      }),
    );
    expect(t).toContain("1 pago en todo el registro");
    expect(t).not.toContain("1 pagos");
    expect(t).not.toContain("1 días");
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

  it("muestra caja final, críticos y cobertura canónica por separado", () => {
    const t = texto(html());
    expect(t).toContain("Caja proyectada 14 días $5.200.000");
    expect(t).toContain("$16.807.705 críticos · 6 pagos");
    expect(t).toContain("No alcanza para los pagos críticos.");
    expect(t).not.toContain("$2.878.055");
  });

  it("auditoría D01 visible: −$46.865.254 y $10.373.669 nunca muestran $57.238.923", () => {
    const t = texto(html({ pagos: pagosAuditoriaD01() }));

    expect(t).toContain("Caja proyectada 14 días −$46.865.254");
    expect(t).toContain("$10.373.669 críticos · 1 pago");
    expect(t).not.toContain("$57.238.923");
    expect(t).not.toContain("faltan $");
  });

  /* Única página completa del tope (100 filas), cada una con su detalle y su acción de
     documento: es el render más caro de la suite y excede el timeout por defecto cuando los
     archivos corren en paralelo. El margen es de tiempo, no de cobertura — no se relaja ninguna
     aserción. */
  it("lista sin críticos visibles conserva el agregado global y la cobertura", () => {
    const t = texto(html({ pagos: pagosListaTopeadaSinCriticos() }));

    expect(t).toContain("$250.000 críticos · 1 pago");
    expect(t).toContain("No alcanza para los pagos críticos.");
    expect(t).not.toContain("$0 críticos");
  }, 20_000);

  it("USD 830 crítico sin TC se abstiene del subtotal sin alterar la cobertura", () => {
    const usdSinTc = {
      ...KENNEDY,
      category: "debt" as const,
      due_date: "2026-09-01",
      amount: "830",
      currency: "USD",
      amount_clp: null,
    };
    const t = texto(
      html({
        pagos: pagos({
          items: [usdSinTc],
          covers_critical: false,
          non_postponable_or_overdue_14d: {
            amount_clp: null,
            known_amount_clp: "0",
            complete: false,
            count: 1,
            unknown_due_date_count: 0,
            excluded_by_currency: [{ currency: "USD", amount: "830" }],
          },
        }),
      }),
    );

    expect(t).toContain("1 pago crítico · monto sin dato");
    expect(t).toContain("No alcanza para los pagos críticos.");
    expect(t).not.toContain("$0 críticos");
  });

  it("críticos conocidos y sin TC presentan el subtotal conocido como piso", () => {
    const usdSinTc = {
      ...KENNEDY,
      id: "00000000-0000-4000-8000-000000000099",
      category: "debt" as const,
      due_date: "2026-09-02",
      amount: "830",
      currency: "USD",
      amount_clp: null,
    };
    const t = texto(
      html({
        pagos: pagos({
          items: [BICE, usdSinTc],
          non_postponable_or_overdue_14d: {
            amount_clp: null,
            known_amount_clp: "503076",
            complete: false,
            count: 2,
            unknown_due_date_count: 0,
            excluded_by_currency: [{ currency: "USD", amount: "830" }],
          },
        }),
      }),
    );

    expect(t).toContain("Al menos $503.076 críticos · 2 pagos");
    expect(t).not.toContain("Pagos críticos en todo el registro: $503.076");
  });

  it("se abstiene de publicar un monto negociable sin agregado global del API", () => {
    const h = html();
    expect(texto(h)).not.toContain("es negociable");
    expect(texto(h)).not.toContain("La decisión de qué postergar vive en Hoy");
    expect(texto(h)).not.toContain("Ver Hoy");
    expect(texto(html({ pagos: pagosSoloImpuestosYSueldos() }))).not.toContain("es negociable");
  });

  it("con un brief canónico conserva los pagos como evidencia y quita el plan local de postergación", () => {
    const h = html({ suppressRecommendations: true });
    const t = texto(h);

    // Los agregados del servidor y la evidencia se conservan: el Brief no los reemplaza.
    expect(t).toContain("Por pagar 14 días $17.998.105");
    expect(t).toContain("Inmobiliaria Vista Kennedy SpA");
    expect(t).not.toContain("Los pagos se muestran en el orden publicado por la fuente.");

    /* Lo que SÍ desaparece son las señales de DECISIÓN locales: la columna de tipo con sus
       pills y el pie de la Ley 9, que es política de postergación. */
    expect(t).not.toContain("Negociable");
    expect(t).not.toContain("No se posterga");
    expect(t).not.toContain("Impuestos y sueldos jamás entran en postergaciones automáticas.");
    expect(h).not.toContain(">Tipo<");

    /* Gemelos con la MISMA cadena sobre el render sin supresión: si estos rótulos
       desaparecieran también del modo normal, las ausencias de arriba pasarían por buenas
       sin medir nada. */
    const conPlanLocal = texto(html());
    const hConPlanLocal = html();
    expect(conPlanLocal).toContain("Negociable");
    expect(conPlanLocal).toContain("No se posterga");
    expect(conPlanLocal).not.toContain(
      "Impuestos y sueldos jamás entran en postergaciones automáticas.",
    );
    expect(hConPlanLocal).toContain(">Tipo<");
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
    // Ninguna pill ni nota técnica dice "Servicio".
    expect(html()).not.toMatch(/>Servicio</);
    expect(t).not.toContain("La fuente todavía no distingue servicios recurrentes");
    expect(t).not.toContain("spec");
  });

  it("NO existe un botón 'pagar todo' (Ley 9), y el texto fijo de la ley está literal", () => {
    const h = html();
    // Ningún botón ni link "Pagar todo" en el DOM (la única mención es la declaración de que NO existe).
    expect(h).not.toMatch(/<(button|a)\b[^>]*>[^<]*[Pp]agar todo/);
    expect(texto(h)).not.toContain("No existe un botón “pagar todo”");
    expect(texto(h)).not.toContain(
      "Impuestos y sueldos jamás entran en postergaciones automáticas.",
    );
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
    const h = html({ pagos: pagosConDuplicado(), anomalias: [ANOMALIA_ENTEL] });
    expect(rojos(h)).toBe(1);
    expect(elRojo(h)).toBe("Revisar");
    // El otro duplicado va en ámbar con la misma palabra (dos "Revisar", un solo rojo).
    expect((texto(h).match(/Revisar/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // Gemelo del negativo: la MISMA query que en el caso normal ya no encuentra la fecha en rojo.
    expect(elRojo(h)).not.toBe("en 2 días");
    expect(texto(h)).toContain(
      "posible duplicado señalado por el registro: Factura 9017 (27 ago, $205.000)",
    );
  });

  it("sin datos o sin respuesta: ningún rojo", () => {
    expect(rojos(html({ pagos: pagosVacio() }))).toBe(0);
    expect(rojos(html({ pagos: null }))).toBe(0);
  });

  it("sin señal de anomalías no afirma que no haya duplicados", () => {
    const t = texto(html({ pagos: pagosConDuplicado(), anomalias: null }));
    expect(t).toContain("No tenemos la señal de posibles duplicados todavía.");
    expect(t).not.toContain("posible duplicado señalado por el registro");
  });

  it("un pago sin UUID declara correlación de anomalías incompleta", () => {
    const t = texto(html({ pagos: pagos({ items: [{ ...KENNEDY, id: null }] }), anomalias: [] }));
    expect(t).toContain(
      "Algunos pagos no tienen identificador estable; no pudimos correlacionar sus posibles duplicados.",
    );
    // Gemelo positivo: con UUID la misma señal vacía no abre el aviso.
    expect(texto(html({ pagos: pagos({ items: [KENNEDY] }), anomalias: [] }))).not.toContain(
      "Algunos pagos no tienen identificador estable; no pudimos correlacionar sus posibles duplicados.",
    );
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

  it("conteo sin fecha con monto ausente se muestra como no disponible, no como $0", () => {
    const t = texto(html({ pagos: pagos({ undated_count: 1, undated_amount: undefined }) }));

    expect(t).toContain("1 documento con monto no disponible sin fecha, en ningún tramo");
    expect(t).not.toContain("1 documento por $0 sin fecha");
  });

  it("caja proyectada en USD conserva su unidad y la cobertura se abstiene", () => {
    const t = texto(html({ pagos: pagosDegradados() }));
    expect(t).toMatch(/Caja proyectada 14 días US\$\s10\.500,00/);
    expect(t).toContain("Cobertura sin dato.");
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

describe("PagarV05View — certeza de la fecha (server-owned, contrato #558)", () => {
  const NOTA_TELEFONICA =
    "Fecha estimada a 30 días desde la emisión; el documento no trae vencimiento pactado.";

  it("pill y nota server-owned por fila: 'Fecha estimada' con su nota; 'Fecha sin confirmar' sola", () => {
    const h = html({ pagos: pagosConFechasEstimadas() });
    const t = texto(h);
    // Dos filas estimadas (Telefónica y el F29) → dos pills; una sin confirmar → una pill.
    const pills = (etiqueta: string) =>
      (h.match(new RegExp(`class="[^"]*rounded-full[^"]*"[^>]*>${etiqueta}<`, "g")) ?? []).length;
    expect(pills("Fecha aproximada")).toBe(2);
    expect(pills("Fecha por confirmar")).toBe(1);
    // La nota se muestra una sola vez en el detalle de la fila.
    expect((t.match(new RegExp(NOTA_TELEFONICA.replace(/[.;]/g, "\\$&"), "g")) ?? []).length).toBe(
      1,
    );
    expect(t).toContain("Fecha Fecha aproximada");
    // Sin nota no se inventa una: el arriendo lleva la pill y nada más.
    expect(t).toContain("Fecha Fecha por confirmar");
    expect(t).not.toMatch(/Fecha por confirmar · /);
    // Gemelo: las confirmadas no llevan pill ni línea de certeza.
    expect(html()).not.toMatch(/>Fecha aproximada<|>Fecha por confirmar<|>Sin fecha confirmada</);
  });

  it("una fecha estimada o sin confirmar nunca se pinta como vencida ni como crítica", () => {
    const h = html({ pagos: pagosConFechasEstimadas() });
    // El arriendo (20 ago, hace 10 días) NO va en ámbar: no es mora confirmada.
    expect(h).toMatch(/class="[^"]*text-rediseno-tinta-3[^"]*"[^>]*>hace 10 días</);
    expect(h).not.toMatch(/class="[^"]*rediseno-ambar[^"]*"[^>]*>hace 10 días</);
    // Gemelo: Kennedy (confirmada) sí va en ámbar con la MISMA query.
    expect(h).toMatch(/class="[^"]*rediseno-ambar[^"]*"[^>]*>hace 545 días</);
    // Ley 2: el único rojo sigue siendo la fila crítica confirmada (BICE, en 2 días); el F29
    // estimado a 6 días no compite por él.
    expect(rojos(h)).toBe(1);
    expect(elRojo(h)).toBe("en 2 días");
  });

  it("conteo de estimados del servidor en Por pagar; con 0 no se dice nada", () => {
    const t = texto(html({ pagos: pagosConFechasEstimadas() }));
    expect(t).toContain("2 pagos con fecha aproximada");
    expect(t).not.toContain("Hoy: 2 pagos con fecha estimada según el registro");
    expect(texto(html())).not.toContain("con fecha aproximada");
    expect(texto(html())).not.toContain("Hoy: ");
    // No se recuenta desde la página: 1 según el servidor aunque haya 2 filas estimadas.
    const uno = texto(html({ pagos: pagosConFechasEstimadas({ estimated_due_date_count: 1 }) }));
    expect(uno).toContain("1 pago con fecha aproximada");
    expect(uno).not.toContain("1 pagos");
  });

  it("sin el campo no se asume confirmada y no usa ámbar", () => {
    const sinCampo = { ...KENNEDY, due_date_certainty: undefined as never };
    const h = html({ pagos: pagos({ items: [sinCampo] }) });
    expect(h).toContain(">Sin fecha confirmada<");
    expect(h).not.toMatch(/class="[^"]*rediseno-ambar[^"]*"[^>]*>hace 545 días</);
    expect(html({ pagos: pagos({ items: [KENNEDY] }) })).not.toContain(">Sin fecha confirmada<");
  });
});
