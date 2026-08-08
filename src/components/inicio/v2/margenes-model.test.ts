import { describe, it, expect } from "vitest";
import { margenesMesAnterior } from "./margenes-model";
import type { OperationalResultResponse } from "@/lib/api/gestion";

/* Modelo Márgenes: bruto (del backend o derivado) + neto (resultado/ventas), mes cerrado. */

function resp(o: Partial<OperationalResultResponse>): OperationalResultResponse {
  return {
    period: "2026-07",
    revenue: "0",
    direct_cost: "0",
    gross_margin: "0",
    gross_margin_pct: "",
    labor_cost: "0",
    professional_fees: "0",
    result: "0",
    ...o,
  } as unknown as OperationalResultResponse;
}

describe("margenesMesAnterior", () => {
  it("usa el gross_margin_pct del backend si vino", () => {
    const r = margenesMesAnterior(
      resp({ revenue: "10000000", gross_margin: "4000000", gross_margin_pct: "40", result: "1500000" }),
    );
    expect(r!.brutoPct).toBe(40);
    expect(r!.brutoMonto).toBe(4000000);
    expect(r!.netoPct).toBe(15); // 1.5M / 10M
    expect(r!.netoMonto).toBe(1500000);
    expect(r!.mesLabel).toBe("jul");
  });

  it("deriva el bruto% si el backend no lo mandó", () => {
    const r = margenesMesAnterior(
      resp({ revenue: "8000000", gross_margin: "2000000", gross_margin_pct: "", result: "0" }),
    );
    expect(r!.brutoPct).toBe(25); // 2M / 8M
  });

  it("neto negativo se conserva (perdió)", () => {
    const r = margenesMesAnterior(resp({ revenue: "5000000", result: "-1000000" }));
    expect(r!.netoMonto).toBe(-1000000);
    expect(r!.netoPct).toBe(-20);
  });

  it("pct null si no hay ventas", () => {
    const r = margenesMesAnterior(resp({ revenue: "0", gross_margin: "0", result: "0" }));
    expect(r!.brutoPct).toBeNull();
    expect(r!.netoPct).toBeNull();
  });

  it("null si no hay respuesta", () => {
    expect(margenesMesAnterior(undefined)).toBeNull();
  });
});
