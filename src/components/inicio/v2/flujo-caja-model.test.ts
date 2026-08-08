import { describe, it, expect } from "vitest";
import { flujoCajaReal } from "./flujo-caja-model";
import type { CashFlowReportResponse } from "@/lib/api/treasury-reports";

/* Modelo del widget "Flujo de caja" (real): entró/salió/neto por mes CERRADO, excluyendo el mes en curso. */

function resp(buckets: Array<{ period: string; inflow: string; outflow: string; net: string }>) {
  return {
    period_from: buckets[0]?.period ?? "2026-05",
    period_to: buckets.at(-1)?.period ?? "2026-07",
    granularity: "month",
    financial_layer: "committed",
    group_by: "none",
    currency: "functional",
    buckets: buckets.map((b) => ({
      period: b.period,
      total_inflow: b.inflow,
      total_outflow: b.outflow,
      net: b.net,
    })),
  } as unknown as CashFlowReportResponse;
}

describe("flujoCajaReal", () => {
  it("deriva entró/salió/neto por mes y ordena cronológicamente", () => {
    const r = flujoCajaReal(
      resp([
        { period: "2026-06", inflow: "5000000", outflow: "3000000", net: "2000000" },
        { period: "2026-05", inflow: "4000000", outflow: "4500000", net: "-500000" },
      ]),
      "2026-08",
    );
    expect(r).not.toBeNull();
    expect(r!.meses.map((m) => m.periodo)).toEqual(["2026-05", "2026-06"]);
    expect(r!.ultimo.periodo).toBe("2026-06");
    expect(r!.ultimo.ingresos).toBe(5000000);
    expect(r!.ultimo.egresos).toBe(3000000);
    expect(r!.ultimo.neto).toBe(2000000);
    // Neto negativo se respeta (mayo salió más de lo que entró).
    expect(r!.meses[0].neto).toBe(-500000);
  });

  it("EXCLUYE el mes en curso (incompleto, engaña)", () => {
    const r = flujoCajaReal(
      resp([
        { period: "2026-07", inflow: "6000000", outflow: "2000000", net: "4000000" },
        { period: "2026-08", inflow: "1000000", outflow: "500000", net: "500000" }, // en curso
      ]),
      "2026-08",
    );
    expect(r!.meses.map((m) => m.periodo)).toEqual(["2026-07"]);
    expect(r!.ultimo.periodo).toBe("2026-07");
  });

  it("egresos se muestran como magnitud aunque el outflow venga negativo", () => {
    const r = flujoCajaReal(
      resp([{ period: "2026-07", inflow: "6000000", outflow: "-2000000", net: "4000000" }]),
      "2026-08",
    );
    expect(r!.ultimo.egresos).toBe(2000000);
  });

  it("null si no hay meses cerrados (todo es el mes en curso)", () => {
    const r = flujoCajaReal(
      resp([{ period: "2026-08", inflow: "1000000", outflow: "500000", net: "500000" }]),
      "2026-08",
    );
    expect(r).toBeNull();
  });

  it("null si no hay buckets", () => {
    expect(flujoCajaReal(undefined, "2026-08")).toBeNull();
    expect(flujoCajaReal(resp([]), "2026-08")).toBeNull();
  });
});
