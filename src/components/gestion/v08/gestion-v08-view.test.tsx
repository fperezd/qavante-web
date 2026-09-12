import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { GestionV08View } from "./gestion-v08-view";
import {
  HOY,
  alDia,
  alDiaPrevioCompleto,
  breakdown,
  breakdownSinOrigenCounts,
  breakdownTendencia,
  breakdownUnaExcepcion,
  breakdownUnMes,
  ciclo,
  cicloUnDia,
  docsCompras,
  docsVentasRepartidas,
  documentosDescuadrados,
  documentosDescuadradosUno,
  documentosServicioMensual,
  documentosUnoCuadrado,
  mes,
  summary,
  summaryDivergente,
} from "./gestion-v08-fixtures";

/* V08 · Gestión — la vista, renderizada de verdad (react-dom/server, sin browser).
 *
 * Lo que se fija acá se fija sobre el HTML: las CIFRAS, la Ley 2 CONTADA sobre los tokens rojos y
 * los "no sé" con su gemelo positivo. Las interacciones (cambiar de tab, expandir, buscar) viven
 * en las stories, que corren en Chromium. La lógica pura vive en `gestion-v08-model.test.ts`. */

type Props = ComponentProps<typeof GestionV08View>;

function html(props: Partial<Props> = {}): string {
  return renderToStaticMarkup(
    <GestionV08View
      tab="resultado"
      onTabChange={() => {}}
      summary={summary()}
      breakdown={breakdown()}
      breakdownLargo={breakdownTendencia()}
      mes={mes()}
      alDia={alDia()}
      alDiaPrevioCompleto={alDiaPrevioCompleto()}
      ciclo={ciclo()}
      hoy={HOY}
      onReintentar={() => {}}
      issueSucesor="#92"
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

describe("V08 · marco de tabs", () => {
  it("las seis tabs están y sólo UNA queda seleccionada", () => {
    const h = html({ tab: "margenes" });
    const t = texto(h);
    for (const label of [
      "Resultado",
      "Márgenes",
      "Tendencia",
      "Comparativo",
      "Clientes 360",
      "Proveedores 360",
    ]) {
      expect(t).toContain(label);
    }
    expect((h.match(/aria-selected="true"/g) ?? []).length).toBe(1);
    expect(h).toContain('id="tab-margenes" aria-selected="true"');
  });

  it("cada tab publica su propia pregunta (Ley 10)", () => {
    expect(texto(html({ tab: "resultado" }))).toContain("¿Gano o pierdo?");
    expect(texto(html({ tab: "margenes" }))).toContain("¿Cuánto te queda de cada peso que vendes?");
    expect(texto(html({ tab: "comparativo" }))).toContain("¿Cómo vas este mes contra el anterior?");
  });
});

describe("MUTANTE (a) · el Resultado del mes es el número de V01", () => {
  it("el titular publica $16.779.336 y dice de dónde sale", () => {
    const t = texto(html());
    expect(t).toContain("Jul 2026 va con $16.779.336 de resultado (margen 42%)");
    expect(t).toContain("Es el mismo número que muestra el Inicio");
  });

  it("con los dos motores de acuerdo la pantalla NO tiene ningún rojo (§5.3)", () => {
    const h = html();
    expect(rojos(h)).toBe(0);
    expect(texto(h)).not.toContain("Dos motores publican un resultado distinto");
  });

  it("cuando divergen, se muestran LOS DOS números con su endpoint y hay UN solo rojo", () => {
    const h = html({ summary: summaryDivergente() });
    const t = texto(h);
    expect(t).toContain("Dos motores publican un resultado distinto para jul 2026");
    expect(t).toContain("$16.779.000"); // lo que publica el Inicio
    expect(t).toContain("$16.779.336"); // lo que suma este cuadro
    expect(t).toContain("una diferencia de $336");
    expect(t).toContain("/api/dashboard/summary");
    expect(t).toContain("/api/management/operational-result/breakdown");
    expect(rojos(h)).toBe(1);
  });

  it("sin resultado del Inicio no se inventa un titular", () => {
    const t = texto(html({ summary: null }));
    expect(t).toContain("Todavía no sabemos tu resultado del mes");
    expect(t).not.toContain("va con $");
  });
});

describe("pivote del Resultado", () => {
  it("las tres secciones con sus montos de los tres meses", () => {
    const t = texto(html());
    expect(t).toContain("Ingresos");
    expect(t).toContain("30.958.134");
    expect(t).toContain("28.267.191");
    expect(t).toContain("39.945.158");
    expect(t).toContain("−23.165.822");
    expect(t).toContain("Resultado operacional");
    expect(t).toContain("16.779.336");
  });

  it("la variación de Ingresos contra junio es +41,3 %", () => {
    expect(texto(html())).toContain("+41,3%");
  });

  it("la caption (sr-only) concuerda en plural con los tres meses del pivote", () => {
    expect(texto(html())).toContain(
      "Estado de Resultados por cuenta, 3 meses. Cada cuenta se abre hasta el documento.",
    );
  });

  /* Mismo defecto de concordancia que "Los 1 proveedores" (PR #93), acá con `months.length`: la
   * caption es genérica sobre `months`, aunque el cableado real siempre pida 3. */
  it("con UN solo mes, la caption dice '1 mes' — no '1 meses'", () => {
    const t = texto(html({ breakdown: breakdownUnMes() }));
    expect(t).toContain(
      "Estado de Resultados por cuenta, 1 mes. Cada cuenta se abre hasta el documento.",
    );
    expect(t).not.toContain("1 meses");
  });

  it("Ley 7 — sólo el mes MÁS RECIENTE queda visible en angosto; los viejos se colapsan", () => {
    const h = html();
    // Las celdas de may y jun llevan la clase de colapso; las de julio NO.
    expect(h).toMatch(/hidden sm:table-cell[^"]*"[^>]*>30\.958\.134/);
    expect(h).not.toMatch(/hidden sm:table-cell[^"]*"[^>]*>39\.945\.158/);
    // Gemelo positivo: julio SÍ está en el HTML (no desapareció, sólo no se colapsa).
    expect(texto(h)).toContain("39.945.158");
  });
});

describe("MUTANTE (d) · footer del pivote", () => {
  it("el export del pivote espera al Excel nativo y declara su estado", () => {
    const h = html({ exportandoPivote: true });
    expect(h).toContain('disabled=""');
    expect(texto(h)).toContain("Preparando Excel…");
    expect(texto(html())).toContain("Exportar Excel");
  });

  it("si Excel falla, explica qué fuente no respondió", () => {
    const mensaje = "El archivo Excel no respondió.";
    const t = texto(html({ errorExportPivote: mensaje }));
    expect(t).toContain(mensaje);
    expect(texto(html())).not.toContain(mensaje);
  });

  it("si la descarga termina, confirma Excel sin confundirlo con CSV", () => {
    const t = texto(html({ exitoExportPivote: "Excel descargado." }));
    expect(t).toContain("Excel descargado.");
    expect(t).toContain("Exportar Excel");
    expect(t).not.toContain("Exportar CSV");
  });

  it("con el conteo del motor dice cuántas excepciones quedan fuera", () => {
    const t = texto(html());
    expect(t).toContain("no incluye 3 excepciones");
    expect(t).toContain("devengado, sin IVA");
    expect(t).toContain("Exportar Excel");
  });

  it("SIN el conteo dice que no lo sabe — y NUNCA muestra 0", () => {
    const t = texto(html({ breakdown: breakdownSinOrigenCounts() }));
    expect(t).toContain("no sabemos cuántas excepciones quedan fuera de este cuadro");
    expect(t).not.toContain("no incluye 0 excepciones");
    // Gemelo positivo con la MISMA consulta: con el conteo, la frase de "no incluye N" sí aparece.
    expect(texto(html())).toContain("no incluye 3 excepciones");
  });

  /* PR #93, tercera vuelta — el mismo defecto de concordancia sobrevivió acá: con `excepciones.n
   * === 1` decía "no incluye 1 excepciones". */
  it("con UNA sola excepción, dice 'no incluye 1 excepción' — no '1 excepciones'", () => {
    const t = texto(html({ breakdown: breakdownUnaExcepcion() }));
    expect(t).toContain("no incluye 1 excepción · documentos que la cascada no logró clasificar");
    expect(t).not.toContain("1 excepciones");
    // Gemelo positivo con N>1, misma consulta: el plural sigue vivo cuando corresponde.
    expect(texto(html())).toContain("no incluye 3 excepciones");
  });
});

describe("MUTANTE (e) · drill-down monto → documentos", () => {
  const abierto = {
    account: "operating_income.service_monthly",
    label: "Servicio mensual",
    period: "2026-07",
  };

  it("lista folio + contraparte y declara que suman exactamente la celda", () => {
    const h = html({ drill: abierto, drillDocs: documentosServicioMensual() });
    const t = texto(h);
    expect(t).toContain("FAC 435 · Comercial Kaufmann S.A.");
    expect(t).toContain("FAC 434 · Tepille SpA");
    expect(t).toContain("8.408.839");
    expect(t).toContain("3 documentos · suman $14.616.879, exactamente el monto de la celda");
    expect(rojos(h)).toBe(0);
  });

  it("si la lista NO suma su total, lo dice — y ése es el ÚNICO rojo", () => {
    const h = html({ drill: abierto, drillDocs: documentosDescuadrados() });
    const t = texto(h);
    expect(t).toContain("Los 2 documentos listados suman $13.037.430");
    expect(t).toContain("la cuenta declara $14.616.879");
    expect(t).toContain("no confíes en esta lista como completa");
    expect(rojos(h)).toBe(1);
  });

  /* PR #93 — el mismo defecto de concordancia que "Los 1 proveedores", en el drill-down: con UN
   * solo documento listado, "Los 1 documentos ... suman" es tan falso como el original. */
  it("con UN solo documento descuadrado, el texto concuerda en singular (no 'Los 1 documentos')", () => {
    const h = html({ drill: abierto, drillDocs: documentosDescuadradosUno() });
    const t = texto(h);
    expect(t).toContain("El documento listado suma $8.408.839");
    expect(t).toContain("la cuenta declara $14.616.879");
    expect(t).toContain("no confíes en esta lista como completa");
    expect(t).not.toContain("1 documentos");
    expect(t).not.toContain("Los 1");
    expect(rojos(h)).toBe(1);
  });

  /* PR #93, tercera vuelta — el mismo defecto sobrevivió en la rama SANA (la que NO descuadra):
   * con `resuelto.count === 1` decía "1 documentos · suman", y el verbo también quedaba en
   * plural pegado a un singular. */
  it("con UN solo documento que SÍ cuadra, dice '1 documento · suma' — no '1 documentos · suman'", () => {
    const h = html({ drill: abierto, drillDocs: documentosUnoCuadrado() });
    const t = texto(h);
    expect(t).toContain("1 documento · suma $8.408.839, exactamente el monto de la celda");
    expect(t).not.toContain("1 documentos");
    expect(t).not.toContain("documento · suman");
    expect(rojos(h)).toBe(0);
    // Gemelo positivo con N>1, misma consulta: el plural (y su verbo) siguen vivos.
    expect(texto(html({ drill: abierto, drillDocs: documentosServicioMensual() }))).toContain(
      "3 documentos · suman $14.616.879, exactamente el monto de la celda",
    );
  });

  it("mientras carga dice qué trae y cuánto tarda (§5.4)", () => {
    const t = texto(html({ drill: abierto, drillDocs: null, drillCargando: true }));
    expect(t).toContain("Estamos trayendo los documentos de Servicio mensual en jul 2026 (~3 s)");
  });
});

describe("sección Costos y gastos (dentro de Resultado)", () => {
  it("las cuentas del mes, de mayor a menor, con su % de ingresos", () => {
    const t = texto(html());
    expect(t).toContain("Remuneraciones administración");
    expect(t).toContain("−$11.968.052");
    expect(t).toContain("30%");
    expect(t).toContain("Otros sin clasificar");
    expect(t).toContain("bajan la confianza del dato");
  });

  it("declara que la descarga Excel conserva las filas y montos del cuadro", () => {
    const t = texto(html());
    expect(t).toContain("La descarga Excel contiene las mismas filas y montos del cuadro");
  });
});

describe("MUTANTE (b) · Comparativo — la regla de oro", () => {
  const h = () => html({ tab: "comparativo" });

  it("las columnas dicen 'al día 23' y el banner enuncia la regla", () => {
    const t = texto(h());
    expect(t).toContain("Ago 2026 va en curso (día 23)");
    expect(t).toContain("se compara contra jul 2026 a la misma altura del mes");
    expect(t).toContain("nunca contra el mes completo");
    expect(t).toContain("ago 26 · al día 23");
    expect(t).toContain("jul 26 · al día 23");
    expect(t).toContain("jul 26 completo");
  });

  it("el delta es +11,8 % (misma altura), NO −12,5 % (contra el mes completo)", () => {
    const t = texto(h());
    expect(t).toContain("+11,8%");
    expect(t).not.toContain("−12,5%");
    expect(t).toContain("$34.932.877");
    expect(t).toContain("$31.240.115");
    expect(t).toContain("$39.945.158"); // el mes completo, sólo como referencia
  });

  it("declara qué NO entra en el corte al día (apellido de la cifra)", () => {
    expect(texto(h())).toContain(
      "flujo del registro de compras y ventas, sin nómina ni honorarios",
    );
  });

  it("sin el corte al día NO se simula: se dice por qué no hay comparativo", () => {
    const t = texto(html({ tab: "comparativo", alDia: null }));
    expect(t).toContain("No pudimos consultar la comparación con el mes anterior");
    expect(t).toContain("No lo simulamos recortando una serie mensual");
    // Gemelo positivo: con el corte, la tabla del comparativo sí aparece.
    expect(texto(h())).toContain("ago 26 · al día 23");
  });
});

describe("Márgenes (con Ciclo de caja y Punto de equilibrio)", () => {
  const h = () => html({ tab: "margenes" });

  it("los tres KPI y el margen neto QUE ES el resultado del tab Resultado (Ley 1)", () => {
    const t = texto(h());
    expect(t).toContain("Margen bruto");
    expect(t).toContain("$32.430.984 · 81,2%");
    expect(t).toContain("Costo de ventas");
    expect(t).toContain("$7.514.174 · 18,8%");
    expect(t).toContain("Margen neto");
    expect(t).toContain("$16.779.336 · 42%");
  });

  it("el DPO conserva su 'no sé' con motivo, y el DSO sí se publica", () => {
    const t = texto(h());
    expect(t).toContain("53 días");
    expect(t).toContain("necesita tu costo de ventas del período");
    expect(t).not.toContain("0 días");
  });

  /* PR #93, tercera vuelta — el mismo defecto sobrevivió en el banner del ciclo de caja: la
   * tarjeta de arriba (formatDays) sí concordaba, pero el banner de abajo usaba el número crudo
   * y decía "Cobras en 1 días." al lado de la tarjeta que decía "1 día" para el MISMO dato. */
  it("con DSO de UN día, el banner dice 'Cobras en 1 día.' — no '1 días', y concuerda con la tarjeta", () => {
    const t = texto(html({ tab: "margenes", ciclo: cicloUnDia() }));
    expect(t).toContain("Cobras en 1 día.");
    expect(t).not.toContain("1 días");
    // La tarjeta del KPI (arriba) y el banner (abajo) publican el MISMO dato con el MISMO formato.
    expect(t).toContain("Cobras en (DSO) 1 día");
    // Gemelo positivo con N>1, misma consulta: el plural del banner sigue vivo (DSO = 53).
    expect(texto(h())).toContain("Cobras en 53 días.");
  });

  it("el punto de equilibrio ancla en el último mes CERRADO, no en el mes en curso", () => {
    const t = texto(h());
    expect(t).toContain("Si gastas como en jun 2026, necesitas vender $9.469.080 al mes");
    expect(t).toContain("Ese mes vendiste $28.267.191");
    expect(t).toContain("cubriste el piso con $18.798.111 de holgura");
    expect(t).toContain("El mes en curso no se usa: está a medio llegar");
  });

  it("sin ningún rojo: nada de esto es crítico y accionable a la vez (Ley 2)", () => {
    expect(rojos(h())).toBe(0);
  });
});

describe("Tendencia", () => {
  it("mejor, peor y promedio salen sólo de meses cerrados", () => {
    const t = texto(html({ tab: "tendencia" }));
    expect(t).toContain("Mejor mes");
    expect(t).toContain("jul 26 · 42%");
    expect(t).toContain("Peor mes");
    expect(t).toContain("feb 26 · −31,7%");
    expect(t).toContain("Promedio del período");
    expect(t).toContain("18,1%");
    expect(t).toContain("sólo meses cerrados");
  });

  it("sin la serie larga no se dibujan barras inventadas", () => {
    const t = texto(html({ tab: "tendencia", breakdownLargo: null }));
    expect(t).toContain("No pudimos consultar la serie de tus márgenes");
  });
});

describe("MUTANTE (c) · 360 — el umbral de concentración", () => {
  it("un proveedor con 54,4 % dispara la alerta y es el ÚNICO rojo", () => {
    const h = html({ tab: "proveedores", docs360: docsCompras() });
    const t = texto(h);
    expect(t).toContain("TD Synnex Chile Limitada");
    expect(t).toContain("54,4%");
    expect(t).toContain("concentración alta · sobre el 30%");
    expect(t).toContain("Dependes mucho de esta contraparte (54,4% de tus compras)");
    expect(rojos(h)).toBe(1);
  });

  it("con la cartera repartida NO hay alerta ni rojo", () => {
    const h = html({ tab: "clientes", docs360: docsVentasRepartidas() });
    const t = texto(h);
    expect(t).toContain("25%");
    expect(t).toContain("bajo el umbral de alerta (30%)");
    expect(t).not.toContain("Dependes mucho de esta contraparte");
    expect(rojos(h)).toBe(0);
  });

  it("'días promedio en pagar' conserva su 'en preparación' honesto", () => {
    const t = texto(html({ tab: "proveedores", docs360: docsCompras() }));
    expect(t).toContain("Días promedio en pagar");
    expect(t).toContain("en preparación");
    expect(t).toContain("necesita cruzar cada factura con su pago en el banco");
    expect(t).toContain("Todavía no lo tenemos, así que no lo estimamos");
  });

  it("la tabla de últimos documentos netea las notas de crédito", () => {
    const t = texto(html({ tab: "proveedores", docs360: docsCompras() }));
    expect(t).toContain("3259");
    expect(t).toContain("−$1.714.965");
    expect(t).toContain("las notas de crédito restan");
  });

  it("sin maestro, la pantalla dice que está ciega y no vacía", () => {
    const t = texto(html({ tab: "clientes", docs360: null }));
    expect(t).toContain("No pudimos consultar tus ventas de los últimos 12 meses");
    expect(t).toContain("esta pantalla no está vacía, está ciega");
  });

  it("con maestro vacío el cero es REAL y se dice así", () => {
    const t = texto(html({ tab: "clientes", docs360: [] }));
    expect(t).toContain("No hay ventas en los últimos 12 meses");
    expect(t).toContain("Este cero es real");
  });
});

describe("estados de carga y error (§5.4)", () => {
  it("ningún 'Cargando…' desnudo: todo estado dice qué trae y cuánto tarda", () => {
    const t = texto(html({ tab: "clientes", docs360: [], docs360Cargando: true }));
    expect(t).toContain("Estamos trayendo tus ventas de los últimos 12 meses, mes por mes (~15 s)");
  });

  it("sin breakdown, el Resultado declara la causa y ofrece reintentar", () => {
    const t = texto(html({ breakdown: null }));
    expect(t).toContain("No pudimos consultar tu Estado de Resultados");
    expect(t).toContain("Reintentar");
  });
});
