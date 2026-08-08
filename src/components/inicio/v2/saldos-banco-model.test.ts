import { describe, it, expect } from "vitest";
import { saldosBanco } from "./saldos-banco-model";
import type { SaldoResponse } from "@/lib/api/treasury";

/* Modelo Saldos en banco: saldo por cuenta + total CLP (sin mezclar monedas). */

function resp(
  cuentas: Array<{
    numeroCuenta: string;
    numeroFormateado?: string;
    nombreCuenta?: string;
    codigoMoneda?: string;
    esExtranjera: boolean;
    saldoContable?: string;
  }>,
): SaldoResponse {
  return { status: "ok", cuentas } as unknown as SaldoResponse;
}

describe("saldosBanco", () => {
  it("mapea cuentas y suma solo las CLP en el total", () => {
    const r = saldosBanco(
      resp([
        { numeroCuenta: "1", nombreCuenta: "Cuenta Corriente", esExtranjera: false, saldoContable: "5000000" },
        { numeroCuenta: "2", nombreCuenta: "Vista", esExtranjera: false, saldoContable: "1500000" },
        { numeroCuenta: "3", nombreCuenta: "USD", codigoMoneda: "USD", esExtranjera: true, saldoContable: "2000" },
      ]),
    );
    expect(r!.cuentas).toHaveLength(3);
    expect(r!.totalClp).toBe(6500000); // no suma la USD
  });

  it("usa numeroFormateado como nombre si falta nombreCuenta", () => {
    const r = saldosBanco(
      resp([{ numeroCuenta: "123", numeroFormateado: "0012-3", esExtranjera: false, saldoContable: "100" }]),
    );
    expect(r!.cuentas[0]!.nombre).toBe("0012-3");
  });

  it("saldo negativo se conserva", () => {
    const r = saldosBanco(
      resp([{ numeroCuenta: "1", nombreCuenta: "Sobregiro", esExtranjera: false, saldoContable: "-300000" }]),
    );
    expect(r!.totalClp).toBe(-300000);
  });

  it("null si no hay cuentas", () => {
    expect(saldosBanco(resp([]))).toBeNull();
    expect(saldosBanco(undefined)).toBeNull();
  });
});
