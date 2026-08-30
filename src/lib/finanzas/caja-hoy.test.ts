import { describe, expect, it } from "vitest";
import { cajaHoy, saldoCajaHoy } from "./caja-hoy";

/* LEY 1 — "un concepto, un número". Este archivo fija el comportamiento de la fuente ÚNICA del
 * saldo "Caja hoy"; el test de que V01 y `/caja` la usan de verdad vive en
 * `components/inicio/v01/hoy-model.test.ts` (§ "Ley 1"). */

const CON_SALDO = {
  cash_today: { total: "9800000", last_updated: "2026-08-29T08:00:00Z", data_state: "available" },
} as const;

describe("cajaHoy — la fuente única del saldo de hoy", () => {
  it("lee el bloque cash_today tal cual, con su frescura", () => {
    expect(cajaHoy(CON_SALDO)).toEqual({
      monto: 9_800_000,
      actualizado: "2026-08-29T08:00:00Z",
      estado: "available",
    });
    expect(saldoCajaHoy(CON_SALDO)).toBe(9_800_000);
  });

  it("conserva el saldo NEGATIVO (una caja bajo cero es un dato, no un error)", () => {
    // Caso real Tooxs 2026-07-19.
    expect(saldoCajaHoy({ cash_today: { ...CON_SALDO.cash_today, total: "-1121250" } })).toBe(
      -1_121_250,
    );
  });

  it('el CERO verificado se conserva como cero, y NO se confunde con "no sé"', () => {
    const cero = saldoCajaHoy({ cash_today: { ...CON_SALDO.cash_today, total: "0" } });
    expect(cero).toBe(0);
    // Gemelo positivo del negativo de abajo: acá el cero SÍ es un número.
    expect(cero).not.toBeNull();
  });

  it('sin bloque cash_today el saldo es null ("no sé"), NUNCA 0', () => {
    for (const entrada of [null, undefined, {}, { cash_today: null }]) {
      expect(saldoCajaHoy(entrada as never)).toBeNull();
    }
    /* El contrapeso del `toBeNull`: si mañana esto devolviera `0`, el `toBeNull` fallaría, pero
       un `not.toBe(0)` solo no distinguiría `null` de `undefined` ni de `NaN`. */
    expect(saldoCajaHoy(null)).not.toBe(0);
    expect(cajaHoy(null)).toEqual({ monto: null, actualizado: null, estado: null });
  });

  it("un total vacío o basura tampoco se aplasta a $0", () => {
    for (const total of ["", "   ", "s/d"]) {
      expect(saldoCajaHoy({ cash_today: { ...CON_SALDO.cash_today, total } })).toBeNull();
    }
    // Gemelo positivo con la MISMA forma de entrada: un número sí pasa.
    expect(saldoCajaHoy({ cash_today: { ...CON_SALDO.cash_today, total: "1" } })).toBe(1);
  });

  it("propaga la frescura declarada (stale / estimated) sin normalizarla", () => {
    expect(cajaHoy({ cash_today: { ...CON_SALDO.cash_today, data_state: "stale" } }).estado).toBe(
      "stale",
    );
    expect(
      cajaHoy({ cash_today: { ...CON_SALDO.cash_today, data_state: "estimated" } }).estado,
    ).toBe("estimated");
  });
});
