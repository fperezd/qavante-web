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
  entradasSinClasificarLabel,
  motivoIndeterminado,
} from "./caja-v2-map";
import type { CashFlowBucket } from "@/lib/api/treasury-reports";
import type { CashMinimumResponse } from "@/lib/api/cash-minimum";
import type { SaldoPunto } from "./caja-curva-model";

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
