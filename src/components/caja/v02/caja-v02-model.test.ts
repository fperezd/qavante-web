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
  HOY,
  PROYECCION_BAJO_CERO,
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
 * la ventana de 14 días con su postergable (Ley 9), el "no sé" explícito y las exclusiones. Cada
 * negativo lleva su gemelo positivo con el MISMO valor. */

// Signo menos tipográfico (U+2212) de `formatClp`; no un guion.
const MINUS = "−";

describe("kpiHoy — Ley 1: recibe el CajaHoy de la fuente única, no desarma el summary", () => {
  it("el valor es EXACTAMENTE formatClp(cajaHoy(summary).monto)", () => {
    const s = summary();
    const k = kpiHoy(cajaHoy(s), ["BICE"], HOY);
    expect(k.valor).toBe(formatClp(cajaHoy(s).monto!));
    expect(k.valor).toBe("$9.800.000");
  });

  it("chip = banco · hora local del sello ✓ cuando el saldo es de hoy y está `available`", () => {
    const k = kpiHoy(cajaHoy(summary()), ["BICE"], HOY);
    const d = new Date("2026-08-30T08:12:00Z");
    const p = (n: number) => String(n).padStart(2, "0");
    expect(k.chip).toBe(`BICE · ${p(d.getHours())}:${p(d.getMinutes())} ✓`);
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
    const sale = sale14d(pagos(), HOY, { includePostergabilidad: false });
    const causas = causasDelPiso(PROYECCION_BAJO_CERO, {
      order: "source",
      includePostergabilidad: false,
    });

    expect(sale?.postergable).toBe(0);
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
    expect(ancho.esperado + 5_901_036).toBe(20_400_000);
  });

  it("sin forecast → null (no se sabe), no $0", () => {
    expect(entra14d(null)).toBeNull();
    expect(entra14d(undefined)).toBeNull();
  });

  it("forecast sin buckets en la ventana → 0 verificado (el cero es real)", () => {
    expect(entra14d(cobranza({ buckets: [] }))!.esperado).toBe(0);
  });
});

describe("sale14d — due_14d del backend + lo negociable en 14 días", () => {
  it("total = due_14d; postergable = sólo lo NEGOCIABLE que vence en 0..14 días", () => {
    const s = sale14d(pagos(), HOY)!;
    expect(s.total).toBe(35_532_396);
    // Tradolarpeso + Vásquez (supplier, medium) = negociable. F29 (tax) y Sueldos (payroll) NO
    // (Ley 9). Arriendo vence a 20 días: fuera de la ventana aunque sea negociable.
    expect(s.postergable).toBe(674_473 + 325_527);
    expect(s.postergable).toBe(1_000_000);
    expect(s.sinConvertir).toBe(0);
  });

  it("Ley 9: si el F29 y los sueldos entraran como negociables la cifra sería otra (gemelo)", () => {
    const s = sale14d(pagos(), HOY)!;
    expect(s.postergable).not.toBe(1_000_000 + 174_979 + 7_400_000);
    expect(1_000_000 + 174_979 + 7_400_000).toBe(8_574_979);
  });

  it("el corte es 14 días, no 30: el arriendo del día 20 no entra (gemelo con el corte ancho)", () => {
    const s = sale14d(pagos(), HOY)!;
    expect(s.postergable).not.toBe(2_500_000);
    // Movido al día 10, SÍ entra.
    const p = pagos();
    p.items = p.items!.map((it) =>
      it.label === "Arriendo oficina" ? { ...it, due_date: "2026-09-09" } : it,
    );
    expect(sale14d(p, HOY)!.postergable).toBe(2_500_000);
  });

  it("INV-FX-001: una extranjera sin amount_clp no se suma como pesos y se cuenta aparte", () => {
    const p = pagos();
    p.items = [
      ...p.items!,
      {
        label: "AWS",
        category: "supplier",
        due_date: "2026-09-05",
        amount: "1240",
        criticality: "medium",
        source: "Tarjeta",
        currency: "USD",
        amount_clp: "",
      },
    ];
    const s = sale14d(p, HOY)!;
    expect(s.postergable).toBe(1_000_000);
    expect(s.sinConvertir).toBe(1);
  });

  it("sin accounts-payable → null; con due_14d en blanco → null (no $0)", () => {
    expect(sale14d(null, HOY)).toBeNull();
    expect(sale14d(pagos({ due_14d: "" }), HOY)).toBeNull();
  });

  it('items al tope EXACTO del backend (100) → posibleRecorte (remanente #82.4, sin "hay más" en el contrato)', () => {
    const cien = Array.from({ length: 100 }, (_, i) => ({
      label: `Proveedor ${i + 1}`,
      category: "supplier" as const,
      due_date: "2026-09-05",
      amount: "10000",
      criticality: "low" as const,
      source: "SII",
      currency: "CLP",
    }));
    expect(sale14d(pagos({ items: cien }), HOY)!.posibleRecorte).toBe(true);
    // Gemelo: 99 no llega al tope → no hay indicio de recorte.
    expect(sale14d(pagos({ items: cien.slice(0, 99) }), HOY)!.posibleRecorte).toBe(false);
    // Por encima del tope (no debería pasar nunca del backend real) sigue declarando el indicio.
    expect(sale14d(pagos({ items: [...cien, cien[0]!] }), HOY)!.posibleRecorte).toBe(true);
  });
});

describe("puntoMasBajo + semanas — la proyección del backend, sin reinventarla", () => {
  it("el piso es el mínimo de la serie (incluido hoy), con su fecha corta", () => {
    const piso = puntoMasBajo(PROYECCION_BAJO_CERO)!;
    expect(piso.saldo).toBe(-1_121_250);
    expect(piso.fecha).toBe("2026-09-07"); // primer día en que la serie toca el mínimo
    expect(piso.fechaLabel).toBe("7 sep");
    expect(piso.dia).toBe(8);
  });

  it("Ley 2: bajoCero es true SÓLO con el mínimo bajo cero (gemelos con el mismo módulo)", () => {
    expect(puntoMasBajo(PROYECCION_BAJO_CERO)!.bajoCero).toBe(true);
    // La misma proyección, corrida +2M hacia arriba: mínimo +878.750 → no hay rojo.
    const arriba = proyeccion({
      ...PROYECCION_BAJO_CERO,
      saldo_hoy: String(5_078_750 + 2_000_000),
      serie: PROYECCION_BAJO_CERO.serie!.map((p) => ({
        ...p,
        saldo_cierre: String(Number(p.saldo_cierre) + 2_000_000),
      })),
    });
    const piso = puntoMasBajo(arriba)!;
    expect(piso.saldo).toBe(878_750);
    expect(piso.bajoCero).toBe(false);
  });

  it("si el saldo de HOY ya es el mínimo, el piso es hoy (día 0)", () => {
    const p = proyeccion({ saldo_hoy: "-500000", serie: serie(14, () => 100_000) });
    const piso = puntoMasBajo(p)!;
    expect(piso.dia).toBe(0);
    expect(piso.saldo).toBe(-500_000);
    expect(piso.bajoCero).toBe(true);
  });

  it("sin serie → null: no se inventa una curva", () => {
    expect(puntoMasBajo(null)).toBeNull();
    expect(puntoMasBajo(proyeccion({ serie: [] }))).toBeNull();
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
    expect(c.frescura).toBe("Fecha de actualización no disponible");
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
