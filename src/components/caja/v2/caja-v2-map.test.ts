import { describe, it, expect } from "vitest";
import {
  serieDesdeCashFlow,
  serieAnclada,
  labelBucketCorto,
  cajaMinimoCLP,
  bucketPasado,
  bucketEmpezado,
  bucketsDesdeHoy,
  flujoDeBuckets,
  primerCruceFuturo,
  completitudFlujo,
  completitudFlujoVisible,
  entradasSinClasificarLabel,
  motivoIndeterminado,
  cotaSuperiorNoCLPEnPesos,
  monedasSinTecho,
  TECHO_CLP_POR_UNIDAD,
  REFERENCIA_CLP_POR_UNIDAD,
  MARGEN_TECHO_FX,
  UMBRAL_SIN_CLASIFICAR,
} from "./caja-v2-map";
import type { CashFlowBucket } from "@/lib/api/treasury-reports";
import type { CashMinimumResponse } from "@/lib/api/cash-minimum";
import type { SaldoPunto } from "./caja-curva-model";

/** Techo de una moneda que DEBE tenerlo (si no lo tiene, el test que lo pide está mal planteado). */
const techo = (code: string): number => {
  const t = TECHO_CLP_POR_UNIDAD[code];
  if (t == null) throw new Error(`la moneda ${code} no tiene techo aplicable`);
  return t;
};

const bucket = (period: string, net: string): CashFlowBucket =>
  ({ period, net, total_inflow: "0", total_outflow: "0", row_count: 0 }) as CashFlowBucket;

describe("labelBucketCorto", () => {
  it("YYYY-MM-DD → DD-mmm", () => {
    expect(labelBucketCorto("2026-07-14")).toBe("14-jul");
  });
  it("YYYY-MM → mmm", () => {
    expect(labelBucketCorto("2026-03")).toBe("mar");
  });
  it("formato desconocido → passthrough", () => {
    expect(labelBucketCorto("Semana 29")).toBe("Semana 29");
  });
});

describe("serieDesdeCashFlow", () => {
  it("deriva el saldo acumulado desde el saldo de hoy + netos", () => {
    const out = serieDesdeCashFlow(10_000, [
      bucket("2026-07-14", "-3000"),
      bucket("2026-07-21", "1000"),
    ]);
    expect(out).toEqual([
      { label: "hoy", saldo: 10_000 },
      { label: "14-jul", saldo: 7_000 },
      { label: "21-jul", saldo: 8_000 },
    ]);
  });
  it("sin buckets → solo el punto de hoy", () => {
    expect(serieDesdeCashFlow(5_000, [])).toEqual([{ label: "hoy", saldo: 5_000 }]);
  });
});

describe("serieAnclada (trayectoria anclada en el saldo de hoy)", () => {
  const now = new Date(2026, 6, 19); // 19-jul-2026
  const lbl = (p: string) => p;
  it("reconstruye hacia atrás: el último bucket pasado cierra en el saldo de hoy", () => {
    const bs = [bucket("2026-06-29", "-853476"), bucket("2026-07-06", "-15552")]; // dos semanas pasadas
    expect(serieAnclada(-3_935_682, bs, "week", now, lbl).map((p) => p.saldo)).toEqual([
      -3_920_130, -3_935_682,
    ]);
  });
  it("proyecta hacia adelante si todos son futuros", () => {
    const bs = [bucket("2026-07-20", "500"), bucket("2026-07-27", "-300")]; // dos semanas futuras
    expect(serieAnclada(1_000, bs, "week", now, lbl).map((p) => p.saldo)).toEqual([1_500, 1_200]);
  });
  it("no duplica el tramo transcurrido del bucket EN CURSO: ancla en él y cierra en el saldo de hoy (#735)", () => {
    // now = 19-jul (semana 13–19 en curso). Pasado 06-jul (+100) · en curso 13-jul (+50) · futuro 20-jul (−30).
    const bs = [
      bucket("2026-07-06", "100"),
      bucket("2026-07-13", "50"),
      bucket("2026-07-20", "-30"),
    ];
    // El bucket en curso cierra en 1000 (el saldo de hoy), NO en 1050. El pasado se reconstruye a 950
    // (1000 − 50, sin el neto en curso) y el futuro proyecta a 970 (1000 − 30).
    expect(serieAnclada(1_000, bs, "week", now, lbl).map((p) => p.saldo)).toEqual([
      950, 1_000, 970,
    ]);
  });
  it("sin buckets → []", () => {
    expect(serieAnclada(1_000, [], "week", now, lbl)).toEqual([]);
  });
});

describe("bucketEmpezado (ancla de la serie: el bucket en curso ya empezó)", () => {
  const now = new Date(2026, 6, 19); // 19-jul-2026 (semana 13–19 en curso, mes jul)
  it("semana ya terminada / en curso → empezó; futura → no", () => {
    expect(bucketEmpezado("2026-07-06", "week", now)).toBe(true); // terminó, pero empezó
    expect(bucketEmpezado("2026-07-13", "week", now)).toBe(true); // en curso
    expect(bucketEmpezado("2026-07-20", "week", now)).toBe(false); // futura
  });
  it("mes: julio (en curso) empezó; agosto no", () => {
    expect(bucketEmpezado("2026-07", "month", now)).toBe(true);
    expect(bucketEmpezado("2026-08", "month", now)).toBe(false);
  });
  it("período no parseable → false", () => {
    expect(bucketEmpezado("basura", "week", now)).toBe(false);
  });
});

describe("primerCruceFuturo (cruce bajo el mínimo, solo desde hoy)", () => {
  const now = new Date(2026, 6, 19); // 19-jul-2026
  const pt = (saldo: number): SaldoPunto => ({ label: "x", saldo });
  it("ignora el dip reconstruido en un período ya pasado", () => {
    const bs = [bucket("2026-06-29", "0"), bucket("2026-07-27", "0")]; // pasado, futuro
    const serie = [pt(1_000), pt(5_000)]; // el pasado cae bajo el mínimo, el futuro no
    expect(primerCruceFuturo(serie, bs, "week", now, 4_000)).toBeNull();
  });
  it("detecta el cruce en un período futuro", () => {
    const bs = [bucket("2026-06-29", "0"), bucket("2026-07-20", "0"), bucket("2026-07-27", "0")];
    const serie = [pt(5_000), pt(5_000), pt(2_000)]; // cruza en el 3º (futuro)
    expect(primerCruceFuturo(serie, bs, "week", now, 4_000)).toBe(2);
  });
  it("sin mínimo → null", () => {
    expect(primerCruceFuturo([pt(1)], [bucket("2026-07-20", "0")], "week", now, null)).toBeNull();
  });
});

describe("bucketPasado (proyectar desde hoy)", () => {
  const now = new Date(2026, 6, 18); // 18-jul-2026 (dentro de la semana 14–20 jul, mes jul)
  it("semana ya terminada → pasada", () => {
    expect(bucketPasado("2026-07-07", "week", now)).toBe(true);
  });
  it("semana en curso (contiene hoy) → NO pasada", () => {
    expect(bucketPasado("2026-07-14", "week", now)).toBe(false);
  });
  it("semana futura → NO pasada", () => {
    expect(bucketPasado("2026-07-21", "week", now)).toBe(false);
  });
  it("mes: junio ya terminó → pasado; julio (en curso) → no", () => {
    expect(bucketPasado("2026-06", "month", now)).toBe(true);
    expect(bucketPasado("2026-07", "month", now)).toBe(false);
  });
  it("día: ayer → pasado; hoy → no", () => {
    expect(bucketPasado("2026-07-17", "day", now)).toBe(true);
    expect(bucketPasado("2026-07-18", "day", now)).toBe(false);
  });
  it("período no parseable → false (no se descarta)", () => {
    expect(bucketPasado("basura", "week", now)).toBe(false);
  });
});

describe("bucketsDesdeHoy", () => {
  it("semanal: descarta pasadas, conserva la actual + futuras", () => {
    const now = new Date(2026, 6, 18);
    const bs = [
      bucket("2026-06-30", "1"),
      bucket("2026-07-07", "2"),
      bucket("2026-07-14", "3"),
      bucket("2026-07-21", "4"),
    ];
    expect(bucketsDesdeHoy(bs, "week", now).map((b) => b.period)).toEqual([
      "2026-07-14",
      "2026-07-21",
    ]);
  });
  it("mensual: descarta los meses ya cerrados", () => {
    const now = new Date(2026, 6, 18);
    const bs = [bucket("2026-06", "1"), bucket("2026-07", "2"), bucket("2026-08", "3")];
    expect(bucketsDesdeHoy(bs, "month", now).map((b) => b.period)).toEqual(["2026-07", "2026-08"]);
  });
});

describe("flujoDeBuckets", () => {
  it("suma entra/sale/neto de los buckets", () => {
    const bs = [
      { period: "a", total_inflow: "1000", total_outflow: "-400", net: "600", row_count: 0 },
      { period: "b", total_inflow: "500", total_outflow: "-900", net: "-400", row_count: 0 },
    ] as CashFlowBucket[];
    expect(flujoDeBuckets(bs)).toEqual({ entra: 1500, sale: -1300, neto: 200 });
  });
  it("sin buckets → todo 0", () => {
    expect(flujoDeBuckets([])).toEqual({ entra: 0, sale: 0, neto: 0 });
  });
});

describe("cajaMinimoCLP", () => {
  it("toma el umbral CLP", () => {
    const cm = { thresholds: [{ currency_code: "CLP", amount: "4000000" }] } as CashMinimumResponse;
    expect(cajaMinimoCLP(cm)).toBe(4_000_000);
  });
  it("null si no hay umbral CLP", () => {
    const cm = { thresholds: [{ currency_code: "USD", amount: "5000" }] } as CashMinimumResponse;
    expect(cajaMinimoCLP(cm)).toBeNull();
    expect(cajaMinimoCLP(undefined)).toBeNull();
  });
});

/* INV-FX-001 en la DECISIÓN, no solo en la etiqueta: el umbral `incompleto` se calcula con la
   porción EN PESOS de lo sin clasificar (cota inferior del ratio real) y degrada a
   `indeterminado` cuando hay entradas en otra moneda o de moneda desconocida. Antes se sumaba
   USD como si fueran CLP y esa mezcla decidía qué veía el usuario. */
describe("completitudFlujo", () => {
  const sc = (
    inflowByCurrency: { currency: string; inflow: number; count: number }[],
    extra: { count?: number; unknownInflowCount?: number } = {},
  ) => ({
    count: extra.count ?? inflowByCurrency.reduce((a, c) => a + c.count, 0),
    inflowByCurrency,
    unknownInflowCount: extra.unknownInflowCount ?? 0,
  });

  it("sin pendientes → completo", () => {
    expect(completitudFlujo(1_000_000, undefined)).toBe("completo");
    expect(completitudFlujo(1_000_000, sc([], { count: 0 }))).toBe("completo");
  });

  it("solo CLP bajo el umbral → completo; sobre el umbral → incompleto", () => {
    // 100.000 / (1.000.000 + 100.000) ≈ 9% ≤ 20%
    expect(completitudFlujo(1_000_000, sc([{ currency: "CLP", inflow: 100_000, count: 1 }]))).toBe(
      "completo",
    );
    // Caso real Tooxs julio: $1,6M clasificado vs $61,5M sin clasificar.
    expect(
      completitudFlujo(1_600_000, sc([{ currency: "CLP", inflow: 61_500_000, count: 9 }])),
    ).toBe("incompleto");
  });

  it("dos monedas: si la porción CLP ya pasa el umbral, decide sin convertir", () => {
    // La cota inferior (CLP sola) ya supera 20% → agregar USD solo la sube. Veredicto firme.
    expect(
      completitudFlujo(
        1_000_000,
        sc([
          { currency: "CLP", inflow: 900_000, count: 3 },
          { currency: "USD", inflow: 1200, count: 2 },
        ]),
      ),
    ).toBe("incompleto");
  });

  it("dos monedas: si la porción CLP NO decide, es indeterminado (no se convierte USD)", () => {
    // CLP sola da ~9%; los US$1.200 podrían llevarlo sobre 20% o no según el tipo de cambio →
    // no se puede saber sin una tasa, y la tasa es decisión humana. Con el bug, 1.200 sumaban
    // como pesos (ratio ~9,2%) y el veredicto salía "completo" sobre un número inventado.
    expect(
      completitudFlujo(
        1_000_000,
        sc([
          { currency: "CLP", inflow: 100_000, count: 1 },
          { currency: "USD", inflow: 1200, count: 1 },
        ]),
      ),
    ).toBe("indeterminado");
  });

  it("moneda desconocida con entradas → indeterminado", () => {
    expect(
      completitudFlujo(
        1_000_000,
        sc([{ currency: "CLP", inflow: 50_000, count: 1 }], {
          count: 3,
          unknownInflowCount: 2,
        }),
      ),
    ).toBe("indeterminado");
  });

  it("moneda desconocida SOLO en salidas → no afecta el ratio de entradas", () => {
    expect(
      completitudFlujo(
        1_000_000,
        sc([{ currency: "CLP", inflow: 50_000, count: 1 }], {
          count: 3,
          unknownInflowCount: 0,
        }),
      ),
    ).toBe("completo");
  });

  it("USD con inflow 0 (solo egresos) no vuelve indeterminado el veredicto", () => {
    expect(
      completitudFlujo(
        1_000_000,
        sc([
          { currency: "CLP", inflow: 50_000, count: 1 },
          { currency: "USD", inflow: 0, count: 2 },
        ]),
      ),
    ).toBe("completo");
  });

  /* Regresión del review adversarial del #936: `indeterminado` reemplazaba a `completo` en vez de
     a `incompleto`, así que UN dólar sin clasificar borraba el titular — y la bandeja por
     clasificar nunca está vacía, o sea el titular desaparecía siempre (la falla que mató al
     indicador del #956). Con la cota superior, lo extranjero chico ya no puede mover el veredicto. */
  it("un dólar suelto NO borra el titular (caso exacto del review)", () => {
    expect(
      completitudFlujo(
        50_000_000,
        sc([
          { currency: "CLP", inflow: 1_000_000, count: 1 },
          { currency: "USD", inflow: 1, count: 1 },
        ]),
      ),
    ).toBe("completo");
  });

  it("lo extranjero grande frente al ingreso SÍ es indeterminado (ahí la tasa decide)", () => {
    // US$500.000 contra $10M clasificados: hay tasas que dan completo y tasas que dan incompleto.
    expect(
      completitudFlujo(
        10_000_000,
        sc([
          { currency: "CLP", inflow: 1_000, count: 1 },
          { currency: "USD", inflow: 500_000, count: 1 },
        ]),
      ),
    ).toBe("indeterminado");
  });

  it("el techo es una COTA, no una tasa: decide el borde y hacia el lado conservador", () => {
    // entra $100M, nada en CLP pendiente: el umbral se cruza recién cuando unidades·techo > $25M.
    const enElBorde =
      (100_000_000 * UMBRAL_SIN_CLASIFICAR) /
      (techo("USD") * (1 - UMBRAL_SIN_CLASIFICAR));
    expect(
      completitudFlujo(100_000_000, sc([{ currency: "USD", inflow: enElBorde, count: 1 }])),
    ).toBe("completo");
    expect(
      completitudFlujo(100_000_000, sc([{ currency: "USD", inflow: enElBorde * 1.01, count: 1 }])),
    ).toBe("indeterminado");
  });

  it("entra 0 con entradas pendientes → incompleto DEMOSTRABLE, sin ninguna tasa (r ≡ 1)", () => {
    // Solo dólares: no hace falta convertir nada, el ratio real es 1 a cualquier tipo de cambio.
    expect(completitudFlujo(0, sc([{ currency: "USD", inflow: 1200, count: 1 }]))).toBe(
      "incompleto",
    );
    // Ni siquiera hace falta conocer la moneda.
    expect(completitudFlujo(0, sc([], { count: 2, unknownInflowCount: 2 }))).toBe("incompleto");
    // Y en pesos, obvio.
    expect(completitudFlujo(0, sc([{ currency: "CLP", inflow: 5_000, count: 1 }]))).toBe(
      "incompleto",
    );
  });

  it("entra 0 SIN entradas pendientes (solo egresos sin clasificar) → completo", () => {
    expect(completitudFlujo(0, sc([{ currency: "CLP", inflow: 0, count: 3 }], { count: 3 }))).toBe(
      "completo",
    );
  });

  it("entra negativo o NaN cae en el clamp → el argumento vale por r ≡ 1, no por monotonía", () => {
    // `dr/dU = E/(E+U)²` es NEGATIVA con E<0: lo que salva al veredicto es `Math.max(entra, 0)`.
    expect(completitudFlujo(-500_000, sc([{ currency: "CLP", inflow: 100_000, count: 1 }]))).toBe(
      "incompleto",
    );
    expect(completitudFlujo(Number.NaN, sc([{ currency: "CLP", inflow: 100_000, count: 1 }]))).toBe(
      "incompleto",
    );
    expect(completitudFlujo(-500_000, sc([{ currency: "USD", inflow: 1, count: 1 }]))).toBe(
      "incompleto",
    );
  });

  it("moneda desconocida con entra > 0 → indeterminado (es el caso sin cota superior posible)", () => {
    // Endpoint de cuentas caído: no se sabe la moneda, así que ni el techo aplica.
    expect(completitudFlujo(50_000_000, sc([], { count: 9, unknownInflowCount: 9 }))).toBe(
      "indeterminado",
    );
  });

  it("varias monedas extranjeras chicas siguen sin mover el veredicto", () => {
    expect(
      completitudFlujo(
        50_000_000,
        sc([
          { currency: "CLP", inflow: 500_000, count: 1 },
          { currency: "EUR", inflow: 3, count: 1 },
          { currency: "USD", inflow: 2, count: 1 },
        ]),
      ),
    ).toBe("completo");
  });
});

describe("completitudFlujoVisible (el veredicto no se rendea antes que su evidencia)", () => {
  const cargando = {
    count: 4,
    inflowByCurrency: [],
    unknownInflowCount: 4,
    isLoading: true,
  };

  /* Regresión del review adversarial sobre `a949550`: mientras cargaba se devolvía `completo`, o
     sea se cambiaba un flash alarmante por uno de FALSA TRANQUILIDAD — `completo` es la rama que
     muestra Entra/Sale como el flujo del período y sin aviso, justo lo que todavía no se sabe.
     Mientras carga no se afirma NADA: ni completo ni incompleto ni indeterminado. */
  it("mientras carga no hay veredicto: ni el alarmante ni el tranquilizador", () => {
    // Con las cuentas en vuelo el mapa está vacío ⇒ todo cae en desconocido ⇒ `completitudFlujo`
    // sola diría "indeterminado" durante la carga y después se acomodaría.
    expect(completitudFlujo(50_000_000, cargando)).toBe("indeterminado");
    expect(completitudFlujoVisible(50_000_000, cargando)).toBe("cargando");
  });

  it("cargando NUNCA es `completo` (el flash de falsa tranquilidad del caso Tooxs)", () => {
    // Tooxs julio: $1,6M clasificado vs $61,5M sin clasificar. `main` decía `incompleto` y avisaba;
    // el `completo` transitorio pintaba $1,6M como si fuera el flujo del período.
    const tooxsCargando = {
      count: 9,
      inflowByCurrency: [{ currency: "CLP", inflow: 61_500_000, count: 9 }],
      unknownInflowCount: 0,
      isLoading: true,
    };
    expect(completitudFlujoVisible(1_600_000, tooxsCargando)).toBe("cargando");
    expect(completitudFlujoVisible(1_600_000, { ...tooxsCargando, isLoading: false })).toBe(
      "incompleto",
    );
  });

  it("cuando termina de cargar, el veredicto es el real", () => {
    expect(completitudFlujoVisible(50_000_000, { ...cargando, isLoading: false })).toBe(
      "indeterminado",
    );
    expect(
      completitudFlujoVisible(50_000_000, {
        count: 1,
        inflowByCurrency: [{ currency: "CLP", inflow: 61_500_000, count: 1 }],
        unknownInflowCount: 0,
        isLoading: false,
      }),
    ).toBe("incompleto");
  });

  it("sin resumen o sin el flag, se comporta igual que completitudFlujo", () => {
    expect(completitudFlujoVisible(1_000_000, undefined)).toBe("completo");
    expect(
      completitudFlujoVisible(1_600_000, {
        count: 9,
        inflowByCurrency: [{ currency: "CLP", inflow: 61_500_000, count: 9 }],
        unknownInflowCount: 0,
      }),
    ).toBe("incompleto");
  });
});

/* BLOQUEANTE del review adversarial sobre `a949550`: el techo único de 10.000 no era una cota
   superior. El catálogo real del sistema (`core.currencies`, qavante-api
   `0026_multicurrency_base.sql:47-56`) trae UF con `currency_type = 'indexed_unit'` a ~39.500 CLP,
   4x por encima; y como `bank_accounts.currency_code` es CHAR(3) SIN FK y el alta valida solo el
   largo, entra cualquier código de 3 letras (XAU ~2.900.000). Como la rama del techo SOLO puede
   concluir `completo`, quedarse corto no cuesta un `indeterminado` de más: produce un `completo`
   FALSO que esconde el aviso. Estos son los casos exactos que midió el reviewer. */
describe("techo por moneda: lo que no se sabe acotar NO puede dar `completo`", () => {
  const sc = (currency: string, inflow: number) => ({
    count: 1,
    inflowByCurrency: [{ currency, inflow, count: 1 }],
    unknownInflowCount: 0,
  });

  it("UF 500 contra $50M NO da `completo` (verdad a UF≈39.500: 28,3% ⇒ incompleto)", () => {
    expect(completitudFlujo(50_000_000, sc("UF", 500))).toBe("indeterminado");
    // Y el borde que el reviewer citó: con el techo viejo se salía de `completo` recién en 1.249.
    expect(completitudFlujo(50_000_000, sc("UF", 1_249))).toBe("indeterminado");
    expect(completitudFlujo(50_000_000, sc("UF", 1))).toBe("indeterminado");
  });

  it("XAU 20 contra $50M NO da `completo` (código fuera del catálogo, ~$58M reales)", () => {
    expect(completitudFlujo(50_000_000, sc("XAU", 20))).toBe("indeterminado");
    // Cualquier código arbitrario que el backend deje pasar cae igual: no hay cota, no hay `completo`.
    for (const code of ["BTC", "ZZZ", "KWD", "UTM"]) {
      expect(completitudFlujo(50_000_000, sc(code, 5))).toBe("indeterminado");
    }
  });

  it("una sola moneda sin techo contamina el veredicto aunque el resto sí tenga", () => {
    expect(
      completitudFlujo(50_000_000, {
        count: 2,
        inflowByCurrency: [
          { currency: "USD", inflow: 1, count: 1 },
          { currency: "UF", inflow: 1, count: 1 },
        ],
        unknownInflowCount: 0,
      }),
    ).toBe("indeterminado");
  });

  it("US$1.250 contra $50M sigue siendo `completo` (la verdad ahí es completo: 2,3%)", () => {
    // Con el techo viejo este era el borde de la falsa alarma; ahora está holgadamente adentro.
    expect(completitudFlujo(50_000_000, sc("USD", 1_250))).toBe("completo");
    expect(completitudFlujo(50_000_000, sc("USD", 5_000))).toBe("completo");
  });

  it("la banda de falsa alarma se angostó ~6,6x en USD y queda en el margen del techo", () => {
    // Primer valor donde deja de decir `completo`, por bisección.
    const borde = (currency: string, entra: number) => {
      let lo = 0;
      let hi = 1e9;
      for (let i = 0; i < 200; i += 1) {
        const mid = (lo + hi) / 2;
        if (completitudFlujo(entra, sc(currency, mid)) === "completo") lo = mid;
        else hi = mid;
      }
      return hi;
    };
    const E = 50_000_000;
    // Antes (techo único 10.000): `indeterminado` desde US$1.250 vs verdad en US$13.158 ⇒ 10,53x.
    expect(borde("USD", E)).toBeCloseTo(8_223.68, 1);
    // Ahora el anticipo es exactamente el margen del techo, y lo es para TODA moneda de la tabla.
    for (const [code, ref] of Object.entries(REFERENCIA_CLP_POR_UNIDAD)) {
      const verdad = (E * UMBRAL_SIN_CLASIFICAR) / (ref * (1 - UMBRAL_SIN_CLASIFICAR));
      expect(verdad / borde(code, E)).toBeCloseTo(MARGEN_TECHO_FX, 6);
    }
  });
});

/* El techo no es una lista suelta: sus claves son las monedas `fiat` del catálogo real menos CLP.
   Si el catálogo cambia, esto se cae y obliga a mirar el techo — que es justo lo que no pasó con
   UF. Fuente: `core.currencies` (0026_multicurrency_base.sql:47-56) / `core_currency.py:29-38`. */
describe("TECHO_CLP_POR_UNIDAD contra el catálogo real de `core.currencies`", () => {
  // Espejo literal del seed: (code, currency_type).
  const CATALOGO: [string, string][] = [
    ["CLP", "fiat"],
    ["UF", "indexed_unit"],
    ["USD", "fiat"],
    ["EUR", "fiat"],
    ["PEN", "fiat"],
    ["COP", "fiat"],
    ["MXN", "fiat"],
    ["BRL", "fiat"],
  ];

  it("cubre exactamente las fiat del catálogo, menos CLP", () => {
    const esperadas = CATALOGO.filter(([c, t]) => t === "fiat" && c !== "CLP")
      .map(([c]) => c)
      .sort();
    expect(Object.keys(TECHO_CLP_POR_UNIDAD).sort()).toEqual(esperadas);
  });

  it("ninguna unidad indexada tiene techo (UF ~39.500 es el contraejemplo que rompió el anterior)", () => {
    for (const [code, tipo] of CATALOGO) {
      if (tipo === "indexed_unit") expect(TECHO_CLP_POR_UNIDAD[code]).toBeUndefined();
    }
  });

  it("cada techo es la referencia observada por el margen declarado, y va por arriba", () => {
    for (const [code, ref] of Object.entries(REFERENCIA_CLP_POR_UNIDAD)) {
      expect(TECHO_CLP_POR_UNIDAD[code]).toBeCloseTo(ref * MARGEN_TECHO_FX, 6);
      expect(TECHO_CLP_POR_UNIDAD[code]).toBeGreaterThan(ref);
    }
    expect(MARGEN_TECHO_FX).toBeGreaterThanOrEqual(1.5);
  });
});

describe("cotaSuperiorNoCLPEnPesos / monedasSinTecho", () => {
  it("pondera cada moneda por SU techo (ya no suma unidades de monedas distintas)", () => {
    expect(
      cotaSuperiorNoCLPEnPesos({
        count: 3,
        inflowByCurrency: [
          { currency: "CLP", inflow: 9_000_000, count: 1 },
          { currency: "USD", inflow: 1200, count: 1 },
          { currency: "EUR", inflow: 300, count: 1 },
        ],
        unknownInflowCount: 0,
      }),
    ).toBeCloseTo(1200 * techo("USD") + 300 * techo("EUR"), 6);
  });

  it("`null` (no hay cota) apenas una moneda no tiene techo aplicable", () => {
    expect(
      cotaSuperiorNoCLPEnPesos({
        count: 2,
        inflowByCurrency: [
          { currency: "USD", inflow: 10, count: 1 },
          { currency: "UF", inflow: 1, count: 1 },
        ],
        unknownInflowCount: 0,
      }),
    ).toBeNull();
  });

  it("sin input o sin monedas extranjeras → 0, y nombra las monedas sin techo", () => {
    expect(cotaSuperiorNoCLPEnPesos(undefined)).toBe(0);
    expect(
      cotaSuperiorNoCLPEnPesos({
        count: 1,
        inflowByCurrency: [{ currency: "CLP", inflow: 10, count: 1 }],
        unknownInflowCount: 0,
      }),
    ).toBe(0);
    expect(
      monedasSinTecho({
        count: 3,
        inflowByCurrency: [
          { currency: "CLP", inflow: 1, count: 1 },
          { currency: "USD", inflow: 1, count: 1 },
          { currency: "UF", inflow: 1, count: 1 },
          { currency: "XAU", inflow: 1, count: 1 },
        ],
        unknownInflowCount: 0,
      }),
    ).toEqual(["UF", "XAU"]);
  });
});

describe("entradasSinClasificarLabel / motivoIndeterminado", () => {
  it("formatea una cifra POR MONEDA, nunca una suma mezclada", () => {
    const label = entradasSinClasificarLabel({
      count: 2,
      inflowByCurrency: [
        { currency: "CLP", inflow: 61_500_000, count: 1 },
        { currency: "USD", inflow: 1200, count: 1 },
      ],
      unknownInflowCount: 0,
    });
    expect(label).toContain("61.500.000");
    expect(label).toContain("1.200,00");
    expect(label).toContain("·"); // separador, no "+": no se suman
    expect(label).not.toContain("61.501.200");
  });

  it("sin entradas con moneda conocida → null (no se inventa un $0)", () => {
    expect(
      entradasSinClasificarLabel({ count: 2, inflowByCurrency: [], unknownInflowCount: 2 }),
    ).toBeNull();
  });

  it("el motivo nombra la moneda y dice que el tipo de cambio lo elige el usuario", () => {
    const motivo = motivoIndeterminado({
      count: 2,
      inflowByCurrency: [
        { currency: "CLP", inflow: 100_000, count: 1 },
        { currency: "USD", inflow: 1200, count: 1 },
      ],
      unknownInflowCount: 1,
    });
    expect(motivo).toContain("USD");
    expect(motivo).toContain("moneda no conocemos");
    expect(motivo).toContain("tipo de cambio");
  });

  it("todo en CLP → no hay motivo (null)", () => {
    expect(
      motivoIndeterminado({
        count: 1,
        inflowByCurrency: [{ currency: "CLP", inflow: 100_000, count: 1 }],
        unknownInflowCount: 0,
      }),
    ).toBeNull();
  });
});
