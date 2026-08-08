import { describe, it, expect } from "vitest";
import { remuneracionesMes } from "./remuneraciones-model";
import type { PayrollResponse } from "@/lib/api/buk";

/* Modelo Remuneraciones: líquido + dotación + cotizaciones del período. */

function resp(t: Record<string, number> | null, extra?: Record<string, unknown>): PayrollResponse {
  return { totales: t ?? undefined, ...extra } as unknown as PayrollResponse;
}

describe("remuneracionesMes", () => {
  it("toma líquido, dotación y cotizaciones de los totales", () => {
    const r = remuneracionesMes(
      resp({ total_liquido: 8500000, empleados_contados: 12, total_cotizaciones: 4180500 }),
      "2026-07",
    );
    expect(r!.liquido).toBe(8500000);
    expect(r!.empleados).toBe(12);
    expect(r!.cotizaciones).toBe(4180500);
    expect(r!.mesLabel).toBe("jul");
  });

  it("cae al total_liquido de nivel raíz si no hay totales.total_liquido", () => {
    const r = remuneracionesMes(resp(null, { total_liquido: 5000000 }), "2026-07");
    // Sin totales.empleados igual muestra si hay líquido.
    expect(r!.liquido).toBe(5000000);
    expect(r!.empleados).toBeNull();
  });

  it("null si no hay líquido ni dotación", () => {
    expect(remuneracionesMes(resp(null), "2026-07")).toBeNull();
    expect(remuneracionesMes(undefined, "2026-07")).toBeNull();
  });

  it("cotizaciones null si no vinieron", () => {
    const r = remuneracionesMes(resp({ total_liquido: 100, empleados_contados: 1 }), "2026-07");
    expect(r!.cotizaciones).toBeNull();
  });
});
