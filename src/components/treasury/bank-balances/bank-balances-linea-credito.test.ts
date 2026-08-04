import { describe, expect, it } from "vitest";
import { lineaCreditoDe } from "./bank-balances-linea-credito";
import type { BalanceData } from "@/lib/api/treasury";

/* La LC solo se muestra cuando la cuenta tiene cupo aprobado. "Sin línea" ≠ "línea de $0", y el campo
   estrella (lo que Fernando quiere ver) es el DISPONIBLE — "cuánto queda". */

function balance(over: Partial<BalanceData>): BalanceData {
  return {
    titulo: null,
    monto: null,
    saldoContableMonto: "1000000",
    saldoContableCodigoMoneda: "CLP",
    saldoDisponibleMonto: "1200000",
    saldoDisponibleCodigoMoneda: "CLP",
    saldoUtilizadoMonto: null,
    saldoUtilizadoCodigoMoneda: null,
    montoAprobadoMonto: null,
    montoAprobadoCodigoMoneda: null,
    montoUtilizadoMonto: null,
    montoUtilizadoCodigoMoneda: null,
    montoDisponibleMonto: null,
    montoDisponibleCodigoMoneda: null,
    fechaVencimientoSobregiro: null,
    fechaConsultaSaldo: null,
    ...over,
  };
}

describe("lineaCreditoDe", () => {
  it("cuenta con LC: expone cupo / usado / disponible + moneda + venc. sobregiro", () => {
    const lc = lineaCreditoDe(
      balance({
        montoAprobadoMonto: "5000000",
        montoAprobadoCodigoMoneda: "CLP",
        montoUtilizadoMonto: "2000000",
        montoDisponibleMonto: "3000000",
        fechaVencimientoSobregiro: "2026-09-30",
      }),
    );
    expect(lc).not.toBeNull();
    expect(lc).toEqual({
      cupo: 5000000,
      usado: 2000000,
      disponible: 3000000,
      moneda: "CLP",
      vencimientoSobregiro: "2026-09-30",
    });
  });

  it("sin cupo aprobado (null o 0) → null: la cuenta no tiene línea, no mostramos LC de $0", () => {
    expect(lineaCreditoDe(balance({ montoAprobadoMonto: null }))).toBeNull();
    expect(lineaCreditoDe(balance({ montoAprobadoMonto: "0" }))).toBeNull();
    expect(lineaCreditoDe(balance({ montoAprobadoMonto: "  " }))).toBeNull();
  });

  it("si no viene el disponible, lo deriva (cupo − usado, sin negativo)", () => {
    const lc = lineaCreditoDe(
      balance({ montoAprobadoMonto: "5000000", montoUtilizadoMonto: "2000000" }),
    );
    expect(lc?.disponible).toBe(3000000);
    // usado > cupo no da disponible negativo
    const sobre = lineaCreditoDe(
      balance({ montoAprobadoMonto: "1000000", montoUtilizadoMonto: "1500000" }),
    );
    expect(sobre?.disponible).toBe(0);
  });

  it("balance nulo/indefinido → null", () => {
    expect(lineaCreditoDe(null)).toBeNull();
    expect(lineaCreditoDe(undefined)).toBeNull();
  });
});
