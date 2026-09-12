import { describe, expect, it } from "vitest";
import {
  ANCLA_RUTA_VIEJA,
  RUTAS_VIEJAS_V08,
  TABS_V08,
  UMBRAL_CONCENTRACION_PCT,
  alertaConcentracion,
  chequeoLey1,
  comparativoAlDia,
  confianzaDato,
  costosDelMes,
  csvComparativo,
  deltaReglaDeOro,
  destinoRutaVieja,
  diaDelMesSantiago,
  equilibrioResumen,
  excepcionesFooter,
  filasPivote,
  ingredientesInsight,
  ingresoPivote,
  kpisCiclo,
  kpisMargen,
  perfil360,
  resolverDrill,
  resultadoDelMes,
  resultadoPivote,
  tabDesdeQuery,
  tendencia,
  variacionUltimoMes,
} from "./gestion-v08-model";
import {
  HOY,
  alDia,
  alDiaPrevioCompleto,
  breakdown,
  breakdownSinOrigenCounts,
  breakdownTendencia,
  breakdownTendenciaConProforma,
  ciclo,
  docsCompras,
  docsVentasRepartidas,
  documentosDescuadrados,
  documentosServicioMensual,
  mes,
  summary,
  summaryDivergente,
  summarySinResultado,
} from "./gestion-v08-fixtures";

/* V08 · Gestión — el modelo puro.
 *
 * Acá viven los cinco mutantes financieros del pase §6. Cada uno se mata con una cifra CONCRETA,
 * no con un `toBeDefined()`: si el número cambia, el test cae. Los negativos llevan su gemelo
 * positivo con la MISMA consulta (un `not.toBe` cuyo valor nunca aparece pasa siempre). */

describe("tabs y rutas viejas", () => {
  it("son exactamente las seis de la spec, en su orden", () => {
    expect([...TABS_V08]).toEqual([
      "resultado",
      "margenes",
      "tendencia",
      "comparativo",
      "clientes",
      "proveedores",
    ]);
  });

  it("`?tab=` inválida cae en Resultado, la válida se respeta", () => {
    expect(tabDesdeQuery("margenes")).toBe("margenes");
    expect(tabDesdeQuery("pulso")).toBe("resultado");
    expect(tabDesdeQuery(null)).toBe("resultado");
  });

  it("las OCHO sub-rutas de gestión tienen destino; pulso y salud NO se tragan", () => {
    expect(Object.keys(RUTAS_VIEJAS_V08)).toHaveLength(8);
    expect(destinoRutaVieja("/gestion/margenes")).toBe("/gestion?tab=margenes");
    expect(destinoRutaVieja("/gestion/clientes")).toBe("/gestion?tab=clientes");
    // Costos vive DENTRO de Resultado; Ciclo y Equilibrio dentro de Márgenes (HTML 08·C/08·D).
    expect(destinoRutaVieja("/gestion/costos")).toBe("/gestion?tab=resultado#costos");
    expect(destinoRutaVieja("/gestion/ciclo-de-caja")).toBe("/gestion?tab=margenes#ciclo");
    expect(destinoRutaVieja("/gestion/punto-equilibrio")).toBe("/gestion?tab=margenes#equilibrio");
    // Gemelo positivo del negativo de abajo: una ruta de V08 SÍ resuelve.
    expect(destinoRutaVieja("/gestion/tendencia")).toBe("/gestion?tab=tendencia");
    expect(destinoRutaVieja("/gestion/pulso")).toBeNull();
    expect(destinoRutaVieja("/gestion/salud")).toBeNull();
  });

  it("toda ruta con ancla está en el mapa de rutas (no hay anclas huérfanas)", () => {
    for (const ruta of Object.keys(ANCLA_RUTA_VIEJA)) {
      expect(RUTAS_VIEJAS_V08[ruta]).toBeDefined();
    }
  });
});

describe("MUTANTE (a) · Ley 1 — el Resultado del mes es el MISMO número que publica V01", () => {
  it("sale de `operational_result.result` del summary, el campo que lee `indicadoresHoy`", () => {
    expect(resultadoDelMes(summary())).toBe(16779336);
    expect(resultadoDelMes(summarySinResultado())).toBeNull();
  });

  it("con los dos motores de acuerdo NO hay divergencia que declarar", () => {
    const filas = filasPivote(breakdown());
    const pivote = resultadoPivote(filas, "2026-07");
    expect(pivote).toBe(16779336);
    const ch = chequeoLey1(resultadoDelMes(summary()), pivote, "2026-07");
    expect(ch.v01).toBe(16779336);
    expect(ch.diferencia).toBe(0);
    expect(ch.divergen).toBe(false);
  });

  it("si el pivote publica otro número, se DECLARAN los dos — no se elige uno", () => {
    const filas = filasPivote(breakdown());
    const ch = chequeoLey1(
      resultadoDelMes(summaryDivergente()),
      resultadoPivote(filas, "2026-07"),
      "2026-07",
    );
    expect(ch.divergen).toBe(true);
    expect(ch.v01).toBe(16779000);
    expect(ch.pivote).toBe(16779336);
    expect(ch.diferencia).toBe(336);
  });

  it("sin uno de los dos, la comparación no se afirma (ni verdadera ni falsa)", () => {
    const ch = chequeoLey1(null, 16779336, "2026-07");
    expect(ch.diferencia).toBeNull();
    expect(ch.divergen).toBe(false);
  });
});

describe("pivote de tres meses", () => {
  const filas = filasPivote(breakdown());

  it("son tres secciones con sus tres columnas", () => {
    expect(filas.map((f) => f.label)).toEqual([
      "Ingresos",
      "Costos y gastos",
      "Resultado operacional",
    ]);
    expect(filas[0]?.celdas.map((c) => c.periodo)).toEqual(["2026-05", "2026-06", "2026-07"]);
  });

  it("Ingresos de julio = $39.945.158 y su variación contra junio = +41,3 %", () => {
    expect(ingresoPivote(filas, "2026-07")).toBe(39945158);
    expect(filas[0]?.variacionPct).toBeCloseTo(41.31, 1);
  });

  it("MUTANTE (e) · las subcategorías SUMAN su sección, en los tres meses", () => {
    for (const seccion of filas.filter((f) => f.hijos.length > 0)) {
      for (let i = 0; i < seccion.celdas.length; i++) {
        const suma = seccion.hijos.reduce((s, h) => s + (h.celdas[i]?.monto ?? 0), 0);
        expect(suma).toBe(seccion.celdas[i]?.monto);
      }
    }
  });

  it("Ingresos − Costos = Resultado, en los tres meses (el cuadro cierra)", () => {
    const ing = filas.find((f) => f.key === "income");
    const cos = filas.find((f) => f.key === "operating_expense");
    const res = filas.find((f) => f.key === "result");
    for (let i = 0; i < 3; i++) {
      expect((ing?.celdas[i]?.monto ?? 0) + (cos?.celdas[i]?.monto ?? 0)).toBe(
        res?.celdas[i]?.monto,
      );
    }
  });

  it("las cuentas se abren hasta el documento; el subtotal de cierre no se abre", () => {
    expect(filas[0]?.drill).toBe("hijos");
    expect(filas[0]?.hijos[0]?.drill).toBe("documentos");
    expect(filas.find((f) => f.key === "result")?.drill).toBe("ninguno");
  });

  it("una serie DESALINEADA con las columnas da `null`, nunca ceros rellenados", () => {
    const bd = {
      months: ["2026-05", "2026-06", "2026-07"],
      rows: [
        { kind: "section", key: "income", label: "Ingresos", by_month: ["100"], total: "100" },
      ],
      // Gemelo positivo: la fila alineada de abajo SÍ trae montos.
    } as never;
    expect(filasPivote(bd)[0]?.celdas.map((c) => c.monto)).toEqual([null, null, null]);
    expect(filasPivote(breakdown())[0]?.celdas.map((c) => c.monto)).toEqual([
      30958134, 28267191, 39945158,
    ]);
  });

  it("una base de cero no produce '+∞ %': la variación es un no-sé", () => {
    expect(
      variacionUltimoMes([
        { periodo: "a", monto: 0 },
        { periodo: "b", monto: 100 },
      ]),
    ).toBeNull();
    expect(
      variacionUltimoMes([
        { periodo: "a", monto: 100 },
        { periodo: "b", monto: 150 },
      ]),
    ).toBe(50);
  });
});

describe("insight del mes", () => {
  it("publica el resultado de la Ley 1, su margen y el delta contra el mes anterior", () => {
    const filas = filasPivote(breakdown());
    const ing = ingredientesInsight(
      resultadoDelMes(summary()),
      ingresoPivote(filas, "2026-07"),
      resultadoPivote(filas, "2026-06"),
    );
    expect(ing?.resultado).toBe(16779336);
    expect(ing?.margenPct).toBeCloseTo(42.0, 1);
    expect(ing?.deltaVsAnterior).toBe(16779336 - 18798111);
    expect(ing?.positivo).toBe(true);
  });

  it("sin resultado no hay frase inventada", () => {
    expect(ingredientesInsight(null, 100, 50)).toBeNull();
  });
});

describe("MUTANTE (d) · footer 'no incluye N excepciones'", () => {
  it("con `origen_counts` cuenta los documentos sin clasificar del rango", () => {
    const e = excepcionesFooter(breakdown());
    expect(e.n).toBe(3);
    expect(e.apellido).toContain("no logró clasificar");
  });

  it("SIN `origen_counts` es `null` — nunca 0", () => {
    const e = excepcionesFooter(breakdownSinOrigenCounts());
    expect(e.n).toBeNull();
    // El gemelo positivo: el mismo cuadro CON origen_counts sí sabe cuántas son.
    expect(excepcionesFooter(breakdown()).n).toBe(3);
  });

  it("sin cuadro tampoco se inventa un cero", () => {
    expect(excepcionesFooter(null).n).toBeNull();
  });
});

describe("costos y gastos (sección de Resultado, HTML 08·C)", () => {
  const filas = filasPivote(breakdown());
  const lineas = costosDelMes(filas, "2026-07");

  it("ordena de mayor a menor y suma el total de la sección", () => {
    expect(lineas[0]?.label).toBe("Remuneraciones administración");
    expect(lineas[0]?.monto).toBe(11968052);
    expect(lineas.reduce((s, l) => s + l.monto, 0)).toBe(23165822);
  });

  it("el % de ingresos es sobre el ingreso del MISMO mes", () => {
    expect(lineas[0]?.pctIngresos).toBeCloseTo(29.96, 1);
  });

  it("marca lo sin clasificar y baja la confianza del dato en consecuencia", () => {
    const sin = lineas.find((l) => l.label === "Otros sin clasificar");
    expect(sin?.sinClasificar).toBe(true);
    expect(lineas.find((l) => l.label === "Arriendos")?.sinClasificar).toBe(false);
    const c = confianzaDato(lineas);
    expect(c.montoSinClasificar).toBe(203293);
    expect(c.pctDelCosto).toBeCloseTo(0.88, 2);
    expect(c.nivel).toBe("alta");
  });

  it("un mes sin costo en una cuenta NO inventa una línea de $0", () => {
    const may = costosDelMes(filas, "2026-05");
    expect(may.some((l) => l.label === "Otros sin clasificar")).toBe(false);
    expect(may.some((l) => l.label === "Arriendos")).toBe(true);
  });
});

describe("MUTANTE (e) · drill-down monto → documentos", () => {
  it("los documentos suman EXACTAMENTE la celda que se expandió", () => {
    const d = resolverDrill(documentosServicioMensual());
    expect(d?.totalDeclarado).toBe(14616879);
    expect(d?.totalSumado).toBe(14616879);
    expect(d?.descuadra).toBe(false);
    expect(d?.documentos.map((x) => x.folio)).toEqual(["FAC 435", "FAC 434", "FAC 436"]);
    expect(d?.documentos[0]?.contraparte).toBe("Comercial Kaufmann S.A.");
  });

  it("si la lista NO suma su total, se declara el descuadre", () => {
    const d = resolverDrill(documentosDescuadrados());
    expect(d?.totalSumado).toBe(13037430);
    expect(d?.totalDeclarado).toBe(14616879);
    expect(d?.descuadra).toBe(true);
  });
});

describe("MUTANTE (b) · comparativo — la regla de oro", () => {
  const c = comparativoAlDia(alDia(), alDiaPrevioCompleto());

  it("compara agosto al día 23 contra JULIO AL DÍA 23, no contra julio completo", () => {
    expect(c?.hastaDia).toBe(23);
    expect(c?.periodo).toBe("2026-08");
    expect(c?.periodoAnterior).toBe("2026-07");
    const ingresos = c?.filas.find((f) => f.key === "revenue");
    expect(ingresos?.actual).toBe(34932877);
    expect(ingresos?.anteriorMismaAltura).toBe(31240115);
    expect(ingresos?.anteriorCompleto).toBe(39945158);
    // +11,8 % contra la misma altura. Contra el mes COMPLETO daría −12,5 %: el signo se invierte.
    expect(ingresos?.deltaPct).toBeCloseTo(11.82, 2);
    expect(ingresos?.deltaPct).toBeGreaterThan(0);
  });

  it("el delta contra el mes completo (lo que la regla PROHÍBE) es otro número y otro signo", () => {
    const ingresos = c?.filas.find((f) => f.key === "revenue");
    const prohibido = deltaReglaDeOro(ingresos?.actual ?? null, ingresos?.anteriorCompleto ?? null);
    expect(prohibido).toBeCloseTo(-12.55, 2);
    expect(ingresos?.deltaPct).not.toBeCloseTo(prohibido ?? 0, 2);
  });

  it("los tres conceptos del HTML, con su resultado", () => {
    expect(c?.filas.map((f) => f.label)).toEqual(["Ingresos", "Margen bruto", "Resultado"]);
    const res = c?.filas.find((f) => f.key === "result");
    expect(res?.actual).toBe(15172641);
    expect(res?.anteriorMismaAltura).toBe(13014227);
    expect(res?.deltaPct).toBeCloseTo(16.585, 2);
  });

  it("una referencia de OTRO período se descarta en vez de pintarse como el mes anterior", () => {
    const otra = { ...alDiaPrevioCompleto(), period: "2026-05" } as never;
    const c2 = comparativoAlDia(alDia(), otra);
    expect(c2?.faltaReferencia).toBe(true);
    expect(c2?.filas[0]?.anteriorCompleto).toBeNull();
    // Gemelo positivo: con la referencia del mes correcto, la columna gris SÍ aparece.
    expect(c?.faltaReferencia).toBe(false);
    expect(c?.filas[0]?.anteriorCompleto).toBe(39945158);
  });

  it("sin `al-dia` no hay comparativo simulado en el front", () => {
    expect(comparativoAlDia(null, alDiaPrevioCompleto())).toBeNull();
  });

  it("el CSV nombra el corte al día en cada columna", () => {
    const csv = csvComparativo(c!);
    expect(csv.split("\n")[0]).toBe(
      "concepto;2026-08_al_dia_23;2026-07_al_dia_23;2026-07_completo;variacion_pct_misma_altura",
    );
  });

  it("`hasta_dia` sale del día en Santiago, no del UTC del Worker", () => {
    expect(diaDelMesSantiago(HOY)).toBe(23);
    // 1 de septiembre 00:30 en Santiago es todavía 04:30 UTC del día 1: el día NO se corre.
    expect(diaDelMesSantiago(new Date("2026-09-01T00:30:00-04:00"))).toBe(1);
  });
});

describe("márgenes", () => {
  it("los tres KPI del HTML 08·B, del MISMO endpoint del mes", () => {
    const k = kpisMargen(mes());
    expect(k?.map((x) => x.label)).toEqual(["Margen bruto", "Costo de ventas", "Margen neto"]);
    expect(k?.[0]?.monto).toBe(32430984);
    expect(k?.[0]?.pct).toBeCloseTo(81.2, 1);
    expect(k?.[1]?.monto).toBe(7514174);
    expect(k?.[1]?.pct).toBeCloseTo(18.81, 1);
    expect(k?.[2]?.monto).toBe(16779336);
    expect(k?.[2]?.pct).toBeCloseTo(42.0, 1);
  });

  it("el margen neto del tab Márgenes es el MISMO resultado que el tab Resultado (Ley 1)", () => {
    expect(kpisMargen(mes())?.[2]?.monto).toBe(resultadoDelMes(summary()));
  });

  it("sin dato del mes no hay KPI inventados", () => {
    expect(kpisMargen(null)).toBeNull();
  });
});

describe("tendencia", () => {
  it("el margen de cada mes sale de su propio resultado sobre su propio ingreso", () => {
    const t = tendencia(breakdownTendencia());
    expect(t?.puntos.map((p) => Math.round((p.margenPct ?? 0) * 10) / 10)).toEqual([
      -31.7, 32, 12, 36, 18, 42,
    ]);
    expect(t?.mejor?.periodo).toBe("2026-07");
    expect(t?.peor?.periodo).toBe("2026-02");
    expect(t?.promedioPct).toBeCloseTo(18.05, 2);
  });

  it("el mes EN CURSO se marca y NO compite por mejor/peor/promedio", () => {
    const t = tendencia(breakdownTendenciaConProforma());
    expect(t?.puntos.at(-1)?.proforma).toBe(true);
    expect(t?.puntos.at(-1)?.margenPct).toBeCloseTo(90, 1);
    // 90 % de medio mes NO se corona mejor mes; los tres agregados quedan iguales que arriba.
    expect(t?.mejor?.periodo).toBe("2026-07");
    expect(t?.peor?.periodo).toBe("2026-02");
    expect(t?.promedioPct).toBeCloseTo(18.05, 2);
  });
});

describe("ciclo de caja y punto de equilibrio (bloque de Márgenes)", () => {
  it("el DSO se publica y el DPO dice POR QUÉ no se sabe", () => {
    const k = kpisCiclo(ciclo());
    expect(k?.[0]?.dias).toBe(53);
    expect(k?.[0]?.motivo).toBeNull();
    expect(k?.[1]?.dias).toBeNull();
    expect(k?.[1]?.motivo).toContain("costo de ventas");
    expect(k?.[2]?.dias).toBeNull();
  });

  it("el piso de venta es lo que gastaste el último mes CERRADO, no el mes en curso", () => {
    const e = equilibrioResumen(breakdown());
    // Julio es proforma → el ancla es junio, que está completo.
    expect(e?.mes).toBe("2026-06");
    expect(e?.pisoDeVenta).toBe(9469080);
    expect(e?.ingresoMes).toBe(28267191);
    expect(e?.holgura).toBe(28267191 - 9469080);
    expect(e?.cubierto).toBe(true);
  });
});

describe("MUTANTE (c) · 360 — el umbral de concentración es 30 %", () => {
  it("el umbral es 30 y decide justo en el borde", () => {
    expect(UMBRAL_CONCENTRACION_PCT).toBe(30);
    expect(alertaConcentracion(30.1)).toBe(true);
    expect(alertaConcentracion(30)).toBe(false);
    expect(alertaConcentracion(29.9)).toBe(false);
  });

  it("un 'no sé' NO es una alerta de dependencia", () => {
    expect(alertaConcentracion(null)).toBe(false);
  });

  it("TD Synnex concentra el 54,4 % de las compras → alerta", () => {
    const docs = docsCompras();
    const total = 7145761 + 5000000 + 1000000;
    const p = perfil360(docs, "77.915.170-0", "2025-09", "2026-08", total);
    expect(p?.nombre).toBe("TD Synnex Chile Limitada");
    expect(p?.volumen12m).toBe(7145761); // las dos NC restan
    expect(p?.concentracionPct).toBeCloseTo(54.36, 2);
    expect(p?.alerta).toBe(true);
    expect(p?.documentos).toBe(4);
    expect(p?.ultimaActividad).toBe("2026-07");
    expect(p?.ultimos[0]?.tipo).toBe("Nota de crédito");
    expect(p?.ultimos[0]?.monto).toBe(-1714965);
  });

  it("con la cartera repartida NINGÚN cliente dispara la alerta", () => {
    const docs = docsVentasRepartidas();
    const p = perfil360(docs, "76.100.100-1", "2025-09", "2026-08", 20000000);
    expect(p?.concentracionPct).toBeCloseTo(25, 2);
    expect(p?.alerta).toBe(false);
  });

  it("una contraparte sin actividad en la ventana no devuelve un perfil vacío", () => {
    expect(perfil360(docsCompras(), "99.999.999-9", "2025-09", "2026-08", 1000)).toBeNull();
  });
});
