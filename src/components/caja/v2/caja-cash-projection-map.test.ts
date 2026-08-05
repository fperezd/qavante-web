import { describe, it, expect } from "vitest";
import {
  cashProjectionToDiasCaja,
  causasFromCashProjection,
  cobrosPorCobrarVencido,
  recuperacionAtraso,
} from "./caja-cash-projection-map";
import type { CashProjectionResponse } from "@/lib/api/treasury";
import { formatDateLike } from "@/lib/formatters/date";

/* Datos reales de Tooxs Digital (prod, 2026-08-03) tras el fix del día-1-dump (#802): la serie ya NO
   amontona el vencido; saldo hoy negativo, quiebre el 04-08. */
const tooxs = {
  as_of: "2026-08-03",
  horizon_days: 90,
  moneda: "CLP",
  saldo_hoy: "-5974198.15",
  minimo: "0",
  dias_de_caja: 1,
  serie: [
    { fecha: "2026-08-04", saldo_cierre: "-49155979.94", capa: "esperado" },
    { fecha: "2026-08-05", saldo_cierre: "-49189506.94", capa: "esperado" },
    { fecha: "2026-08-06", saldo_cierre: "-49189506.94", capa: "esperado" },
  ],
  escenario_duro: { dias_de_caja: 1, piso: "-71762610.64", piso_fecha: "2026-08-31" },
  punto_quiebre: {
    fecha: "2026-08-04",
    saldo: "-49155979.94",
    causas: [
      { glosa: "Remuneraciones", monto: "-15247759.00", tipo: "pago" },
      { glosa: "TD SYNNEX CHILE LIMITADA", monto: "-12770345.00", tipo: "pago" },
    ],
  },
  vencido: { total: "187880452.21", items: [] },
  fuentes: { calidad_fechas: { con_fecha_real: 0.4, items_totales: 255 } },
} as unknown as CashProjectionResponse;

describe("cashProjectionToDiasCaja", () => {
  it("mapea el modelo del backend al medidor (caja en rojo hoy, piso −$49M, días=1)", () => {
    const m = cashProjectionToDiasCaja(tooxs)!;
    expect(m.saldoHoy).toBeCloseTo(-5_974_198.15, 0);
    expect(m.diasHastaMinimo).toBe(1); // AUTORITATIVO del backend
    expect(m.diasHastaCero).toBe(0); // ya está bajo $0 hoy
    expect(m.piso).toEqual({ saldo: -49_155_979.94, dia: 1 }); // el punto de quiebre
    expect(m.estado).toBe("critico"); // toca < 0
    expect(m.diasRecuperacion).toBeNull(); // no se recupera en la serie
    expect(m.horizonteDias).toBe(90);
  });

  it("sin serie → null (no inventa curva)", () => {
    expect(cashProjectionToDiasCaja(undefined)).toBeNull();
    expect(cashProjectionToDiasCaja({ ...tooxs, serie: [] } as CashProjectionResponse)).toBeNull();
  });

  it("caja holgada: sin punto de quiebre → estado sano, piso = mínimo de la serie", () => {
    const holgada = {
      ...tooxs,
      saldo_hoy: "10000000",
      minimo: "2000000",
      dias_de_caja: null,
      punto_quiebre: null,
      serie: [
        { fecha: "2026-08-04", saldo_cierre: "9000000", capa: "esperado" },
        { fecha: "2026-08-05", saldo_cierre: "8000000", capa: "esperado" },
      ],
    } as unknown as CashProjectionResponse;
    const m = cashProjectionToDiasCaja(holgada)!;
    expect(m.estado).toBe("sano"); // nunca baja de la mínima ($2M)
    expect(m.piso?.saldo).toBe(8_000_000); // mínimo de la serie
    expect(m.diasHastaCero).toBeNull();
  });
});

describe("causasFromCashProjection", () => {
  it("mapea las causas del quiebre (glosa + monto firmado + tipo del badge)", () => {
    const c = causasFromCashProjection(tooxs);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ label: "Remuneraciones", monto: -15_247_759, tipo: "otro" });
    expect(c[1]?.label).toBe("TD SYNNEX CHILE LIMITADA");
  });

  it("usa la fecha PROPIA de cada causa (ADR-0087 Ask 2), no la del quiebre para todas", () => {
    const resp = {
      ...tooxs,
      punto_quiebre: {
        fecha: "2026-08-04",
        saldo: "-49155979.94",
        causas: [
          { glosa: "F29 julio", monto: "-9200000", tipo: "f29", fecha: "2026-08-12" },
          { glosa: "Proveedor sin fecha", monto: "-3000000", tipo: "pago" }, // sin fecha → cae a la del quiebre
        ],
      },
    } as unknown as CashProjectionResponse;
    const c = causasFromCashProjection(resp);
    // La causa CON fecha propia usa la suya (12-ago), NO la del quiebre (04-ago).
    expect(c[0]?.fechaLabel).toBe(formatDateLike("2026-08-12"));
    expect(c[0]?.tipo).toBe("impuesto"); // f29 → impuesto
    // La causa SIN fecha propia cae a la del quiebre.
    expect(c[1]?.fechaLabel).toBe(formatDateLike("2026-08-04"));
    expect(c[1]?.tipo).toBe("otro");
  });

  it("sin punto de quiebre → []", () => {
    expect(
      causasFromCashProjection({ ...tooxs, punto_quiebre: null } as CashProjectionResponse),
    ).toEqual([]);
  });
});

describe("cobrosPorCobrarVencido", () => {
  const conVencido = (items: unknown[]) =>
    ({ ...tooxs, vencido: { total: "0", items } }) as unknown as CashProjectionResponse;

  it("lista solo los COBROS (vencido/sin-fecha), no los pagos; ordena por monto desc; lleva folio (#830)", () => {
    const r = cobrosPorCobrarVencido(
      conVencido([
        { glosa: "KAUFMANN", monto: "1440791.00", dias_atraso: null, tipo: "cobro_sin_fecha" },
        { glosa: "SYNNEX", monto: "5000000.00", dias_atraso: 45, tipo: "cobro_vencido", folio: "435" },
        { glosa: "IVA F29", monto: "-4200000.00", dias_atraso: 10, tipo: "pago_vencido" }, // pago: fuera
      ]),
    );
    expect(r.map((c) => c.glosa)).toEqual(["SYNNEX", "KAUFMANN"]); // 5M, 1.44M
    expect(r[0]).toEqual({ glosa: "SYNNEX", monto: 5_000_000, diasAtraso: 45, folio: "435" });
    expect(r[1]).toMatchObject({ diasAtraso: null, folio: null }); // sin fecha, sin folio → null
  });

  it("sin items → []", () => {
    expect(cobrosPorCobrarVencido(conVencido([]))).toEqual([]);
    expect(cobrosPorCobrarVencido(undefined)).toEqual([]);
  });
});

describe("recuperacionAtraso", () => {
  const conRecup = (ec: unknown) =>
    ({ ...tooxs, esperado_con_recuperacion: ec }) as unknown as CashProjectionResponse;

  it("mapea el PISO con recuperación (del punto de quiebre) + total + ventana (datos reales Tooxs)", () => {
    // Validado al peso: la recuperación baja el piso a −$3,6M (vs core −$49M), aunque el runway siga en 1.
    const r = recuperacionAtraso(
      conRecup({
        dias_de_caja: 1,
        recuperacion_days: 30,
        total_recuperado: "13723918",
        serie: [],
        punto_quiebre: { fecha: "2026-08-06", saldo: "-3639436", causas: [] },
      }),
    );
    expect(r).toEqual({ pisoRecup: -3_639_436, totalRecuperado: 13_723_918, ventanaDias: 30 });
  });

  it("total 0 (no hay atraso que cobrar) → null (no mostramos el escenario)", () => {
    expect(
      recuperacionAtraso(
        conRecup({ dias_de_caja: null, recuperacion_days: 30, total_recuperado: "0" }),
      ),
    ).toBeNull();
  });

  it("con recuperación NO toca el quiebre (punto_quiebre null) → pisoRecup null (se sostiene)", () => {
    const r = recuperacionAtraso(
      conRecup({
        dias_de_caja: null,
        recuperacion_days: 30,
        total_recuperado: "5000000",
        punto_quiebre: null,
      }),
    );
    expect(r).toEqual({ pisoRecup: null, totalRecuperado: 5_000_000, ventanaDias: 30 });
  });
});
