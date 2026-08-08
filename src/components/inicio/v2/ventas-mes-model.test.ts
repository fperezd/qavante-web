import { describe, it, expect } from "vitest";
import { ventasPorMes } from "./ventas-mes-model";
import type { LibroComparativosResponse } from "@/lib/api/sii";

/* Modelo Ventas por mes: serie neta mensual + variación del último vs el anterior. */

function resp(serie: Array<{ periodo: string; neto: string }>): LibroComparativosResponse {
  return { neto_periodo: "0", serie_mensual: serie } as unknown as LibroComparativosResponse;
}

describe("ventasPorMes", () => {
  it("ordena la serie y toma el último mes", () => {
    const r = ventasPorMes(
      resp([
        { periodo: "2026-07", neto: "12000000" },
        { periodo: "2026-05", neto: "8000000" },
        { periodo: "2026-06", neto: "10000000" },
      ]),
    );
    expect(r!.meses.map((m) => m.periodo)).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(r!.ultimo.periodo).toBe("2026-07");
    expect(r!.ultimo.neto).toBe(12000000);
  });

  it("calcula la variación del último vs el anterior", () => {
    const r = ventasPorMes(
      resp([
        { periodo: "2026-06", neto: "10000000" },
        { periodo: "2026-07", neto: "12000000" },
      ]),
    );
    expect(r!.variacionPct).toBe(20); // 12 vs 10
  });

  it("variación null si el mes anterior es 0", () => {
    const r = ventasPorMes(
      resp([
        { periodo: "2026-06", neto: "0" },
        { periodo: "2026-07", neto: "5000000" },
      ]),
    );
    expect(r!.variacionPct).toBeNull();
  });

  it("variación null con un solo mes", () => {
    const r = ventasPorMes(resp([{ periodo: "2026-07", neto: "5000000" }]));
    expect(r!.variacionPct).toBeNull();
  });

  it("null si no hay serie", () => {
    expect(ventasPorMes(resp([]))).toBeNull();
    expect(ventasPorMes(undefined)).toBeNull();
  });
});
