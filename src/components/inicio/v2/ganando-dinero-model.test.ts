import { describe, it, expect } from "vitest";
import { resultadoMesAnterior } from "./ganando-dinero-model";
import type { OperationalResultResponse } from "@/lib/api/gestion";

const resp = (period: string, revenue: number, result: number): OperationalResultResponse =>
  ({
    period,
    revenue: String(revenue),
    result: String(result),
  }) as unknown as OperationalResultResponse;

describe("resultadoMesAnterior", () => {
  it("ganó: resultado ≥ 0, con margen y mes legible", () => {
    const r = resultadoMesAnterior(resp("2026-07", 40_000_000, 16_000_000))!;
    expect(r.gano).toBe(true);
    expect(r.resultado).toBe(16_000_000);
    expect(r.margenPct).toBe(40);
    expect(r.mesLabel).toMatch(/jul/i);
    expect(r.confiable).toBe(true);
  });

  it("perdió: resultado < 0", () => {
    const r = resultadoMesAnterior(resp("2026-06", 30_000_000, -5_000_000))!;
    expect(r.gano).toBe(false);
    expect(r.resultado).toBe(-5_000_000);
    expect(r.margenPct).toBe(-17); // -5/30 ≈ -16.7 → -17
    expect(r.confiable).toBe(true);
  });

  it("implausible (resultado ≥ ingresos, margen ≥ 100%) → confiable=false", () => {
    const r = resultadoMesAnterior(resp("2026-07", 40_000_000, 45_000_000))!;
    expect(r.confiable).toBe(false);
  });

  it("sin ingresos → margen null, confiable true (otro caso, no la guarda dura)", () => {
    const r = resultadoMesAnterior(resp("2026-07", 0, 0))!;
    expect(r.margenPct).toBeNull();
    expect(r.confiable).toBe(true);
  });

  it("sin respuesta → null", () => {
    expect(resultadoMesAnterior(undefined)).toBeNull();
  });
});
