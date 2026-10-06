import { describe, expect, it } from "vitest";
import { cajaHoy } from "@/lib/finanzas/caja-hoy";
import { formatClp } from "@/lib/formatters/clp";
import {
  causasDelPiso,
  comoSeCalcula,
  deudaDeDatos,
  entra14d,
  exclusiones,
  fechaQuiebre,
  kpiHoy,
  nombreBancoChip,
  puntoMasBajo,
  sale14d,
  semanas,
  sumarDiasISO,
} from "./caja-v02-model";
import {
  COBERTURA_SIN_EXCLUSIONES,
  HOY,
  PROYECCION_BAJO_CERO,
  PROYECCION_BAJO_EL_MINIMO,
  cobranza,
  pagos,
  proyeccion,
  serie,
  sinClasificar,
  summary,
} from "./caja-v02-fixtures";

/* V02 · Caja — el modelo, fijado.
 *
 * Ley 1 (el "Hoy" sale de `cajaHoy()`), Ley 2 (el mínimo bajo cero es el único candidato a rojo),
 * la ventana de 14 días con su agregado no postergable del servidor (Ley 9), el "no sé" explícito
 * y las exclusiones. Cada negativo lleva su gemelo positivo con el MISMO valor. */

// Signo menos tipográfico (U+2212) de `formatClp`; no un guion.
const MINUS = "−";

describe("kpiHoy — Ley 1: recibe el CajaHoy de la fuente única, no desarma el summary", () => {
  it("el valor es EXACTAMENTE formatClp(cajaHoy(summary).monto)", () => {
    const s = summary();
    const k = kpiHoy(cajaHoy(s), ["BICE"], HOY);
    expect(k.valor).toBe(formatClp(cajaHoy(s).monto!));
    expect(k.valor).toBe("$9.800.000");
  });

  it("chip = banco · hora de Chile del sello ✓ cuando el saldo es de hoy y está `available`", () => {
    const k = kpiHoy(cajaHoy(summary()), ["BICE"], HOY);
    // El sello `2026-08-30T08:12:00Z` son las 04:12 en Chile (agosto, UTC-4). El esperado se
    // escribe literal y no se deriva de `d.getHours()`: derivarlo del huso del runner hacía que
    // la aserción se moviera junto con el código y no pudiera detectar lo contrario.
    expect(k.chip).toBe("BICE · 04:12 ✓");
    expect(k.detalle).toBe("Saldo en tus cuentas · el mismo número que en Hoy");
  });

  it("sello de OTRO día → fecha corta, no una hora que se lee como de hoy", () => {
    const s = summary({
      cash_today: {
        total: "9800000",
        last_updated: "2026-08-28T22:00:00Z",
        data_state: "available",
      },
    });
    const k = kpiHoy(cajaHoy(s), ["BICE"], HOY);
    expect(k.chip).toMatch(/^BICE · 2[89] ago ✓$/);
  });

  it("stale → sin ✓ y con el reparo en el detalle", () => {
    const s = summary({
      cash_today: { total: "9800000", last_updated: "2026-08-30T08:12:00Z", data_state: "stale" },
    });
    const k = kpiHoy(cajaHoy(s), ["BICE"], HOY);
    expect(k.chip).not.toContain("✓");
    expect(k.chip).toMatch(/^BICE · \d{2}:\d{2}$/);
    expect(k.detalle).toBe("Puede estar desactualizado · el mismo número que en Hoy");
  });

  it('sin `cash_today` → valor null (NO "$0"), sin chip y con el motivo', () => {
    const k = kpiHoy(cajaHoy(summary({ cash_today: null })), ["BICE"], HOY);
    expect(k.valor).toBeNull();
    expect(k.chip).toBeNull();
    expect(k.detalle).toBe("Conecta tu banco para ver tu saldo real");
    // Gemelo positivo: el mismo summary CON saldo sí produce "$0"-distinto-de-null.
    expect(kpiHoy(cajaHoy(summary()), [], HOY).valor).not.toBeNull();
  });

  it("un saldo negativo se formatea con el menos tipográfico (no es rojo: eso lo decide el piso)", () => {
    const s = summary({
      cash_today: {
        total: "-1121250",
        last_updated: "2026-08-30T08:12:00Z",
        data_state: "available",
      },
    });
    expect(kpiHoy(cajaHoy(s), [], HOY).valor).toBe(`${MINUS}$1.121.250`);
  });

  it("nombreBancoChip: uno → nombre; varios → 'N bancos'; ninguno → 'Banco'", () => {
    expect(nombreBancoChip(["BICE"])).toBe("BICE");
    expect(nombreBancoChip(["BICE", "BICE", " Santander "])).toBe("2 bancos");
    expect(nombreBancoChip([])).toBe("Banco");
    expect(nombreBancoChip(["  "])).toBe("Banco");
  });
});

describe("evidencia para Decision Brief", () => {
  it("no deriva postergabilidad ni reordena las causas cuando el Brief ya resolvió la decisión", () => {
    const causas = causasDelPiso(PROYECCION_BAJO_CERO, {
      order: "source",
      includePostergabilidad: false,
    });

    /* "Sale · 14 días" ya no deriva nada: consume el agregado del servidor en ambos modos, así
       que no hay una segunda variante que apagar (#302 P2-6). */
    expect(sale14d(pagos())?.noPostergable?.monto).toBe(7_574_979);
    expect(causas.every((causa) => causa.postergable === "sin_identidad")).toBe(true);
    expect(causas.map((causa) => causa.glosa)).toEqual(
      (PROYECCION_BAJO_CERO.punto_quiebre?.causas ?? []).map((causa) => causa.glosa),
    );
  });
});

describe("entra14d — buckets 0-7 y 8-14 del forecast de cobranza", () => {
  it("suma esperado y nominal de los buckets que caen en 14 días, y NO el de 15-30", () => {
    const e = entra14d(cobranza())!;
    expect(e.esperado).toBe(7_000_000 + 7_498_964);
    expect(e.nominal).toBe(8_000_000 + 8_500_000);
    // Gemelo: con el bucket 15-30 dentro de la ventana la cifra sube (el corte es el que resta).
    const ancho = entra14d(
      cobranza({
        buckets: [
          { label: "0-14d", days_from: 0, days_to: 14, nominal: "16500000", expected: "14498964" },
          { label: "15-30d", days_from: 15, days_to: 30, nominal: "6300000", expected: "5901036" },
        ],
      }),
    )!;
    expect(ancho.esperado).toBe(14_498_964);
    expect(ancho.esperado! + 5_901_036).toBe(20_400_000);
  });

  it("sin forecast → null (no se sabe), no $0", () => {
    expect(entra14d(null)).toBeNull();
    expect(entra14d(undefined)).toBeNull();
  });

  it("forecast sin buckets en la ventana → 0 verificado (el cero es real)", () => {
    expect(entra14d(cobranza({ buckets: [] }))!.esperado).toBe(0);
  });
});

describe("sale14d — due_14d del backend + su agregado no postergable, sin sumar items (#302 P2-6)", () => {
  it("total = due_14d; lo no postergable es el agregado del servidor tal cual", () => {
    const s = sale14d(pagos())!;
    expect(s.total).toBe(35_532_396);
    expect(s.noPostergable).toEqual({
      monto: 7_574_979,
      conocido: 7_574_979,
      n: 2,
      completo: true,
      fechasDesconocidas: 0,
      monedasExcluidas: 0,
    });
  });

  it("no reconstruye nada desde `items`: la MISMA respuesta sin ítems da el MISMO agregado", () => {
    const conItems = sale14d(pagos())!;
    const sinItems = sale14d(pagos({ items: [] }))!;
    expect(sinItems).toEqual(conItems);
    /* Control negativo: si el modelo volviera a sumar lo "negociable" de la lista, con estos
       ítems daría 1.000.000 (Tradolarpeso + Vásquez); ese número no existe en la salida. */
    expect(JSON.stringify(conItems)).not.toContain("1000000");
  });

  it("agregado parcial → `monto` null y el conocido como piso; nunca $0 conocido", () => {
    const s = sale14d(
      pagos({
        non_postponable_or_overdue_14d: {
          amount_clp: null,
          known_amount_clp: "174979",
          complete: false,
          count: 2,
          unknown_due_date_count: 1,
          excluded_by_currency: [{ currency: "USD", amount: "830", currency_status: "verified" }],
        },
      }),
    )!;
    expect(s.noPostergable).toEqual({
      monto: null,
      conocido: 174_979,
      n: 2,
      completo: false,
      fechasDesconocidas: 1,
      monedasExcluidas: 1,
    });
  });

  it("sin el agregado en la respuesta → `noPostergable` null (se declara, no se aproxima)", () => {
    const s = sale14d(pagos({ non_postponable_or_overdue_14d: undefined }))!;
    expect(s.total).toBe(35_532_396);
    expect(s.noPostergable).toBeNull();
  });

  it("sin accounts-payable → null; con due_14d en blanco → null (no $0)", () => {
    expect(sale14d(null)).toBeNull();
    expect(sale14d(pagos({ due_14d: "" }))).toBeNull();
  });
});

describe("puntoMasBajo + semanas — la proyección del backend, sin reinventarla", () => {
  it("el piso lo publica el servidor, con su fecha corta; `dia` sólo lo coloca en una barra", () => {
    const piso = puntoMasBajo(PROYECCION_BAJO_CERO)!;
    expect(piso.saldo).toBe(-1_121_250);
    expect(piso.fecha).toBe("2026-09-07"); // `punto_mas_bajo.fecha`, no una búsqueda en la serie
    expect(piso.fechaLabel).toBe("7 sep");
    expect(piso.dia).toBe(8);
    expect(piso.bajoMinimo).toBe(true);
  });

  /* EL CASO QUE ANTES SE PINTABA VERDE. El front comparaba el piso contra CERO; el servidor lo
     compara contra la caja mínima DECLARADA. Con mínimo $5.000.000 y piso $1.200.000 el piso está
     sobre cero (verde con la regla vieja) y bajo el mínimo (rojo con la del servidor). */
  it("bajoMinimo lo decide el servidor contra la caja mínima declarada, no una comparación local contra cero", () => {
    const piso = puntoMasBajo(PROYECCION_BAJO_EL_MINIMO)!;
    expect(piso.saldo).toBe(1_200_000);
    expect(piso.saldo).toBeGreaterThan(0); // la regla vieja no habría pintado nada
    expect(piso.minimo).toBe(5_000_000);
    expect(piso.bajoMinimo).toBe(true);
    expect(piso.brecha).toBe(3_800_000);
  });

  it("gemelo: con el piso sobre el mínimo declarado no hay rojo y la brecha es cero", () => {
    const arriba = proyeccion({
      minimo: "5000000",
      punto_mas_bajo: {
        fecha: "2026-09-07",
        saldo: "6200000",
        minimo: "5000000",
        horizon_days: 28,
        bajo_minimo: false,
        brecha: "0",
        vencido_exigible_excluido: "0",
      },
    });
    const piso = puntoMasBajo(arriba)!;
    expect(piso.bajoMinimo).toBe(false);
    expect(piso.brecha).toBe(0);
  });

  /* Un piso sin la deuda vencida al lado se lee como holgura: el productor declara que, desde la
     decisión del 2026-10-04, lo vencido no se coloca en ningún día de la curva. */
  it("el piso viaja con la deuda ya vencida que NO incluye; ausente no es cero", () => {
    const conVencido = proyeccion({
      punto_mas_bajo: {
        fecha: "2026-09-07",
        saldo: "1200000",
        minimo: "0",
        horizon_days: 28,
        bajo_minimo: false,
        brecha: "0",
        vencido_exigible_excluido: "39600000",
      },
    });
    expect(puntoMasBajo(conVencido)!.vencidoExigibleExcluido).toBe(39_600_000);
    // Cero MEDIDO es un hecho: no hay deuda vencida.
    expect(puntoMasBajo(proyeccion())!.vencidoExigibleExcluido).toBe(0);
    // Ausente es otra cosa, y no se traduce a cero.
    const sinCampo = proyeccion();
    const piso = puntoMasBajo({
      ...sinCampo,
      punto_mas_bajo: { ...sinCampo.punto_mas_bajo, vencido_exigible_excluido: null },
    } as unknown as Parameters<typeof puntoMasBajo>[0])!;
    expect(piso.vencidoExigibleExcluido).toBeNull();
  });

  /* `dia` sólo ubica el piso en una barra. Si la fecha del piso no se puede medir contra
     `as_of`, un día que no se pudo calcular NO es el día 0: ninguna barra se marca, en vez de
     marcar la primera y afirmar que el piso cae esta semana. */
  it("fecha de piso no ubicable → dia null y NINGUNA barra marcada como piso", () => {
    const p = proyeccion({
      punto_mas_bajo: {
        fecha: "no-es-una-fecha",
        saldo: "1200000",
        minimo: "0",
        horizon_days: 28,
        bajo_minimo: false,
        brecha: "0",
        vencido_exigible_excluido: "0",
      },
    });
    expect(puntoMasBajo(p)!.dia).toBeNull();
    expect(semanas(p).some((s) => s.esPiso)).toBe(false);
    // Gemelo: con fecha ubicable, exactamente una barra queda marcada.
    expect(semanas(PROYECCION_BAJO_CERO).filter((s) => s.esPiso)).toHaveLength(1);
  });

  it("sin `punto_mas_bajo` del servidor → null: el mínimo NO se busca en la serie", () => {
    expect(puntoMasBajo(null)).toBeNull();
    const sinPiso = { ...proyeccion(), punto_mas_bajo: undefined };
    expect(puntoMasBajo(sinPiso as unknown as Parameters<typeof puntoMasBajo>[0])).toBeNull();
    expect(semanas(proyeccion({ serie: [] }))).toEqual([]);
  });

  it("4 semanas: neto = cierre − cierre anterior; la segunda carga el piso", () => {
    const s = semanas(PROYECCION_BAJO_CERO);
    expect(s).toHaveLength(4);
    expect(s.map((w) => w.neto)).toEqual([3_400_000, -9_600_000, 4_000_000, 421_250]);
    expect(s.map((w) => w.cierre)).toEqual([8_478_750, -1_121_250, 2_878_750, 3_300_000]);
    expect(s.map((w) => w.esPiso)).toEqual([false, true, false, false]);
    expect(s[0]!.label).toBe("31 ago–6 sep");
    expect(s[1]!.label).toBe("7 sep–13 sep");
    // Los netos de las 4 semanas cierran contra la serie: saldo_hoy + Σ netos = cierre de la 4ª.
    expect(5_078_750 + s.reduce((a, w) => a + w.neto, 0)).toBe(3_300_000);
  });

  it("con el piso en hoy (día 0), la PRIMERA semana lo carga", () => {
    const p = proyeccion({ saldo_hoy: "-500000", serie: serie(28, () => 100_000) });
    expect(semanas(p).map((w) => w.esPiso)).toEqual([true, false, false, false]);
  });

  it("sumarDiasISO cruza el mes sin pasar por la zona horaria local", () => {
    expect(sumarDiasISO("2026-08-30", 1)).toBe("2026-08-31");
    expect(sumarDiasISO("2026-08-30", 2)).toBe("2026-09-01");
    expect(sumarDiasISO("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("causasDelPiso — las causas del quiebre del backend, de mayor a menor", () => {
  it("mapea glosa, fecha corta, monto firmado y tipo; ordena por egreso más grande", () => {
    const c = causasDelPiso(PROYECCION_BAJO_CERO);
    expect(c.map((x) => x.glosa)).toEqual([
      "Tradolarpeso",
      "Soc. de Profesionales Vásquez y Cía.",
      "F29 · IVA agosto",
      "Inmobiliaria Vista Kennedy",
    ]);
    expect(c[0]).toMatchObject({
      monto: -674_473,
      tipo: "pago",
      fechaLabel: "7 sep",
      payableId: "11111111-1111-4111-8111-111111111111",
      postergable: "si",
    });
    expect(c[2]).toMatchObject({ tipo: "impuesto", fechaLabel: "12 sep", postergable: "no" });
    expect(c[3]).toMatchObject({ tipo: "vencido" });
  });

  it("Ley 9: el impuesto es 'no' postergable; el resto es 'desconocido' (no se inventa un sí)", () => {
    const c = causasDelPiso(PROYECCION_BAJO_CERO);
    expect(c.filter((x) => x.postergable === "no").map((x) => x.glosa)).toEqual([
      "F29 · IVA agosto",
    ]);
    expect(c.filter((x) => x.postergable === "si")).toHaveLength(3);
  });

  it("sin quiebre → sin causas y sin fecha de quiebre", () => {
    expect(causasDelPiso(proyeccion())).toEqual([]);
    expect(fechaQuiebre(proyeccion())).toBeNull();
    expect(fechaQuiebre(PROYECCION_BAJO_CERO)).toBe("7 sep");
  });

  it("Ley 9: una remuneración y una causa sin UUID no ofrecen Postergar", () => {
    const p = proyeccion({
      punto_quiebre: {
        fecha: "2026-09-08",
        saldo: "-1",
        causas: [
          { glosa: "Proveedor sin identidad", monto: "-10", tipo: "pago" },
          {
            glosa: "Remuneraciones agosto",
            monto: "-20",
            tipo: "pago",
            payable_id: "44444444-4444-4444-8444-444444444444",
          },
        ],
      },
    });
    expect(causasDelPiso(p).map((c) => c.postergable)).toEqual(["no", "sin_identidad"]);
  });

  it("una causa sin fecha propia cae a la del quiebre", () => {
    const p = proyeccion({
      punto_quiebre: {
        fecha: "2026-09-08",
        saldo: "-1",
        causas: [{ glosa: "X", monto: "-10" }],
      },
    });
    expect(causasDelPiso(p)[0]!.fechaLabel).toBe("8 sep");
  });
});

describe("exclusiones — lo que la proyección deja afuera, con conteo", () => {
  it("por cobrar vencido/sin fecha + obligaciones con fecha estimada", () => {
    expect(exclusiones(PROYECCION_BAJO_CERO)).toEqual([
      "No cuenta $39.600.000 por cobrar vencidos o sin fecha (17 documentos)",
      "3 de 12 obligaciones van con fecha estimada, no real (75% con fecha real)",
    ]);
  });

  it("sin nada declarado → lista vacía (no se inventa una exclusión ni se afirma que no hay)", () => {
    expect(exclusiones(proyeccion())).toEqual([]);
    expect(exclusiones(null)).toEqual([]);
  });

  it("singular: 1 documento y 1 obligación", () => {
    expect(
      exclusiones(
        proyeccion({
          por_cobrar_vencido: { total: "1000", n: 1 },
          fuentes: {
            saldo_synced_at: "2026-08-30T08:12:00Z",
            calidad_fechas: { con_fecha_real: 0, items_totales: 1 },
            cobertura: COBERTURA_SIN_EXCLUSIONES,
          },
        }),
      ),
    ).toEqual([
      "No cuenta $1.000 por cobrar vencidos o sin fecha (1 documento)",
      "1 de 1 obligación va con fecha estimada, no real (0% con fecha real)",
    ]);
  });
});

describe("deudaDeDatos — banner de sin clasificar (INV-FX-001: un monto por moneda)", () => {
  it("count + entradas por moneda", () => {
    const d = deudaDeDatos(sinClasificar())!;
    expect(d.count).toBe(3);
    expect(d.entradasLabel).toBe("$2.100.000");
  });

  it("CLP y USD nunca se suman: dos montos separados", () => {
    const d = deudaDeDatos(
      sinClasificar({
        inflowByCurrency: [
          { currency: "CLP", inflow: 2_100_000, count: 2 },
          { currency: "USD", inflow: 1240, count: 1 },
        ],
      }),
    )!;
    expect(d.entradasLabel).toContain("$2.100.000");
    expect(d.entradasLabel).toContain("US$");
    expect(d.entradasLabel).not.toContain("$2.101.240");
  });

  it("sin pendientes o cargando → null (el banner no se muestra)", () => {
    expect(deudaDeDatos(sinClasificar({ count: 0, inflowByCurrency: [] }))).toBeNull();
    expect(deudaDeDatos(sinClasificar({ isLoading: true }))).toBeNull();
    expect(deudaDeDatos(null)).toBeNull();
  });

  it('en error, el banner NO desaparece: "no sé" explícito, aunque count sea 0 (remanente #82.5)', () => {
    const d = deudaDeDatos(sinClasificar({ isError: true, count: 0, inflowByCurrency: [] }))!;
    expect(d.error).toBe(true);
    // Gemelo: sin error, el mismo count=0 SÍ apaga el banner (no es "count 0 siempre muestra").
    expect(
      deudaDeDatos(sinClasificar({ isError: false, count: 0, inflowByCurrency: [] })),
    ).toBeNull();
  });

  it("error incluso con count>0 stale de una consulta parcial: sigue siendo error, no el conteo parcial", () => {
    const d = deudaDeDatos(sinClasificar({ isError: true, count: 5 }))!;
    expect(d.error).toBe(true);
  });
});

describe("comoSeCalcula — definición, incluye/excluye, fuente y frescura (§1.4)", () => {
  it("con proyección: frescura con as_of y sync del banco; exclusiones del backend", () => {
    const c = comoSeCalcula(PROYECCION_BAJO_CERO, HOY);
    expect(c.frescura).toBe("calculado el 30 ago 2026 · saldo del banco sincronizado hoy");
    expect(c.excluye[0]).toContain("$39.600.000");
    expect(c.fuente).toBe(
      "Saldos bancarios, cobros con fecha y pagos comprometidos registrados en Qavante",
    );
    expect(c.incluye).toHaveLength(3);
  });

  it('sin proyección: frescura honesta y el "no sé" explícito, no una afirmación de exclusiones', () => {
    const c = comoSeCalcula(null, HOY);
    expect(c.frescura).toBe("La proyección no informó cuándo se calculó");
    // "no declara exclusiones" afirmaría que la proyección CORRIÓ y no encontró nada que excluir;
    // acá no hay proyección, así que no hay ni "sí" ni "no" que declarar (remanente #82.2).
    expect(c.excluye).toEqual(["Sin proyección no hay exclusiones que declarar"]);
  });

  it("con proyección y sin exclusiones declaradas: SÍ es una afirmación real (gemelo del anterior)", () => {
    const c = comoSeCalcula(proyeccion(), HOY);
    expect(exclusiones(proyeccion())).toEqual([]);
    expect(c.excluye).toEqual(["La proyección no declara exclusiones para tu empresa"]);
  });
});
