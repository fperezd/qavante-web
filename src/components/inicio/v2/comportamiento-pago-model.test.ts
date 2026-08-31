import { describe, it, expect } from "vitest";
import { comportamientoPago, diaSufijo, facturaFechadaLabel } from "./comportamiento-pago-model";
import type { CollectionProjectionResponse } from "@/lib/api/treasury";

/* Modelo Comportamiento de pago: expone behavior_shift_days + conteos de vs_nominal. */

function resp(
  v: {
    behavior_shift_days?: number | null;
    docs_comportamiento: number;
    docs_por_vencimiento: number;
  } | null,
): CollectionProjectionResponse {
  return { vs_nominal: v ?? undefined } as unknown as CollectionProjectionResponse;
}

describe("comportamientoPago", () => {
  it("expone el desfase y los conteos (pagan después)", () => {
    const r = comportamientoPago(
      resp({ behavior_shift_days: 8, docs_comportamiento: 30, docs_por_vencimiento: 5 }),
    );
    expect(r).toEqual({ shiftDays: 8, docsComportamiento: 30, docsVencimiento: 5 });
  });

  it("conserva desfase negativo (pagan antes)", () => {
    const r = comportamientoPago(
      resp({ behavior_shift_days: -3, docs_comportamiento: 10, docs_por_vencimiento: 0 }),
    );
    expect(r!.shiftDays).toBe(-3);
  });

  it("shiftDays null si no hay comparables pero sí docs", () => {
    const r = comportamientoPago(
      resp({ behavior_shift_days: null, docs_comportamiento: 0, docs_por_vencimiento: 4 }),
    );
    expect(r!.shiftDays).toBeNull();
    expect(r!.docsVencimiento).toBe(4);
  });

  it("null si no hay ninguna factura comparable", () => {
    const r = comportamientoPago(
      resp({ behavior_shift_days: null, docs_comportamiento: 0, docs_por_vencimiento: 0 }),
    );
    expect(r).toBeNull();
  });

  it("null si no vino vs_nominal", () => {
    expect(comportamientoPago(resp(null))).toBeNull();
    expect(comportamientoPago(undefined)).toBeNull();
  });
});

/* Concordancia N=1 (issue #94): un shift promedio de 1 día, o 1 sola factura con historial, son
 * casos reales de una empresa recién con datos — no de laboratorio. El defecto vivo escribía
 * "1 días después" / "1 facturas fechadas". */
describe("diaSufijo", () => {
  it("n=1: singular 'día'", () => {
    expect(diaSufijo(1)).toBe("día");
  });

  // [control positivo] gemelo N≠1.
  it("[control positivo] n=8: plural 'días'", () => {
    expect(diaSufijo(8)).toBe("días");
  });

  it("n=0: plural ('0 días' es correcto en español)", () => {
    expect(diaSufijo(0)).toBe("días");
  });
});

describe("facturaFechadaLabel — frase completa: sustantivo Y adjetivo concuerdan", () => {
  it("n=1: singular 'factura fechada' (no sólo el sustantivo — el adjetivo también)", () => {
    expect(facturaFechadaLabel(1)).toBe("factura fechada");
  });

  // [control positivo] gemelo N≠1.
  it("[control positivo] n=30: plural 'facturas fechadas'", () => {
    expect(facturaFechadaLabel(30)).toBe("facturas fechadas");
  });
});
