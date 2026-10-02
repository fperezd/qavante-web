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
    // CRUDO, sin redondear: el modelo entrega el cociente y `formatPct` decide la
    // precisión. Redondeado acá, Inicio decía "−17%" donde Gestión decía "−16,7%".
    expect(r.margenPct).toBeCloseTo(-16.6667, 4);
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

  it("período abstenido (result null) → null, nunca 'ganó' con 0% (web#318)", () => {
    // Sin la guarda, `parseAmount(null)` daba 0 y el Inicio afirmaba "ganó" sobre un resultado que
    // nadie midió, con margen 0% — el mismo defecto de /gestion, en la pantalla de entrada.
    const abstenido = {
      period: "2026-08",
      revenue: "39443831",
      result: null,
      abstention_reason: "financial_integrity_partial",
    } as unknown as OperationalResultResponse;
    expect(resultadoMesAnterior(abstenido)).toBeNull();
    // Gemelo positivo: el MISMO payload con cifra publicable sí rinde veredicto.
    const publicable = {
      ...abstenido,
      result: "3600000",
      abstention_reason: null,
    } as unknown as OperationalResultResponse;
    expect(resultadoMesAnterior(publicable)?.gano).toBe(true);
  });

  it("resultado medido de $0 sigue dando veredicto (el cero verificado no es abstención)", () => {
    const r = resultadoMesAnterior(resp("2026-07", 40_000_000, 0))!;
    expect(r.gano).toBe(true);
    expect(r.resultado).toBe(0);
  });
});
