import { describe, expect, it } from "vitest";
import { cuposDeTarjeta } from "./banco-model";
import type { TarjetaSaldoData } from "@/lib/api/treasury";

const cupo = (over: Record<string, unknown>) => ({
  totalQuota: null,
  spentQuota: null,
  availableQuota: null,
  billedAmmount: null,
  billDate: null,
  dueDate: null,
  ...over,
});

describe("cuposDeTarjeta", () => {
  it("expone CLP (national) + USD (international) con total/usado/disponible + facturado + venc", () => {
    const saldo = {
      national: cupo({
        totalQuota: 5_000_000,
        spentQuota: 2_000_000,
        availableQuota: 3_000_000,
        billedAmmount: 1_800_000,
        dueDate: "2026-09-05",
      }),
      international: cupo({ totalQuota: 2000, spentQuota: 500, availableQuota: 1500 }),
    } as unknown as TarjetaSaldoData;
    const out = cuposDeTarjeta(saldo);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      moneda: "CLP",
      total: 5_000_000,
      usado: 2_000_000,
      disponible: 3_000_000,
      facturado: 1_800_000,
      vencimiento: "2026-09-05",
    });
    expect(out[1]?.moneda).toBe("USD");
    expect(out[1]?.disponible).toBe(1500);
  });

  it("deriva el disponible (total − usado, sin negativo) si el banco no lo manda", () => {
    const saldo = {
      national: cupo({ totalQuota: 1_000_000, spentQuota: 1_200_000 }), // gastó de más
    } as unknown as TarjetaSaldoData;
    expect(cuposDeTarjeta(saldo)[0]?.disponible).toBe(0);
  });

  it("una moneda SIN ningún monto real no se muestra (no inventa $0)", () => {
    const saldo = { national: cupo({}), international: null } as unknown as TarjetaSaldoData;
    expect(cuposDeTarjeta(saldo)).toEqual([]);
  });

  it("saldo nulo → []", () => {
    expect(cuposDeTarjeta(null)).toEqual([]);
    expect(cuposDeTarjeta(undefined)).toEqual([]);
  });
});
