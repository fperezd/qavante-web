import { describe, it, expect } from "vitest";
import { comportamientoPagoInsight } from "./comportamiento-pago-model";

describe("comportamientoPagoInsight", () => {
  it("pagan TARDE (shift > 0): título + cobertura + tono por magnitud", () => {
    const r = comportamientoPagoInsight({
      vs_nominal: { behavior_shift_days: 12, docs_comportamiento: 18, docs_por_vencimiento: 7 },
    })!;
    expect(r.tarde).toBe(true);
    expect(r.shiftDias).toBe(12);
    expect(r.titulo).toMatch(/12 días después del vencimiento/);
    expect(r.conHistorial).toBe(18);
    expect(r.total).toBe(25);
    expect(r.tono).toBe("warning"); // 7..14 → warning
  });

  it("tono escala con la magnitud del atraso", () => {
    expect(comportamientoPagoInsight({ vs_nominal: { behavior_shift_days: 20 } })!.tono).toBe(
      "danger",
    );
    expect(comportamientoPagoInsight({ vs_nominal: { behavior_shift_days: 10 } })!.tono).toBe(
      "warning",
    );
    expect(comportamientoPagoInsight({ vs_nominal: { behavior_shift_days: 3 } })!.tono).toBe(
      "neutral",
    );
  });

  it("pagan ANTES (shift < 0) → success", () => {
    const r = comportamientoPagoInsight({ vs_nominal: { behavior_shift_days: -4 } })!;
    expect(r.tarde).toBe(false);
    expect(r.tono).toBe("success");
    expect(r.titulo).toMatch(/4 días antes del vencimiento/);
  });

  it("shift 0 → 'justo al vencimiento', success", () => {
    const r = comportamientoPagoInsight({ vs_nominal: { behavior_shift_days: 0 } })!;
    expect(r.titulo).toMatch(/justo al vencimiento/);
    expect(r.tono).toBe("success");
  });

  it("singular: 1 día", () => {
    expect(comportamientoPagoInsight({ vs_nominal: { behavior_shift_days: 1 } })!.titulo).toMatch(
      /1 día después/,
    );
  });

  it("sin comparables (null / no finito / sin vs_nominal) → null (no inventa)", () => {
    expect(comportamientoPagoInsight({ vs_nominal: { behavior_shift_days: null } })).toBeNull();
    expect(comportamientoPagoInsight({ vs_nominal: {} })).toBeNull();
    expect(comportamientoPagoInsight({})).toBeNull();
    expect(comportamientoPagoInsight(null)).toBeNull();
    expect(comportamientoPagoInsight(undefined)).toBeNull();
  });

  it("redondea el shift fraccionario", () => {
    expect(
      comportamientoPagoInsight({ vs_nominal: { behavior_shift_days: 12.6 } })!.shiftDias,
    ).toBe(13);
  });
});
