import { describe, it, expect } from "vitest";
import { cashProjectionToDiasCaja, causasFromCashProjection } from "./caja-cash-projection-map";
import type { CashProjectionResponse } from "@/lib/api/treasury";

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
  it("mapea las causas del quiebre (glosa + monto firmado)", () => {
    const c = causasFromCashProjection(tooxs);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ label: "Remuneraciones", monto: -15_247_759 });
    expect(c[1]?.label).toBe("TD SYNNEX CHILE LIMITADA");
  });
  it("sin punto de quiebre → []", () => {
    expect(
      causasFromCashProjection({ ...tooxs, punto_quiebre: null } as CashProjectionResponse),
    ).toEqual([]);
  });
});
