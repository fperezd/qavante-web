import { describe, expect, it } from "vitest";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import { describeCashGap14d } from "./cash-gap-14d";
import { DEFICIT, NO_DEFICIT } from "./resumen/inicio-resumen.fixtures";

/* La brecha a 14 días es la que publica el backend (D01/D03, #296).
 *
 * La versión anterior recibía `critical_obligations_14d` y `projected_cash_14d` y armaba la
 * brecha en el front: "críticas menos caja" con la caja positiva, o el saldo final con el signo
 * cambiado con la caja negativa. Con el fixture canónico del repo publicaba 10.000.000 donde el
 * contrato dice 14.000.000. Estos tests fijan que el número sale de `cash_gap_amount_14d` y que
 * las otras dos cifras (saldo final, mínimo) se conservan con su nombre, sin mezclarse. */

/** Una variante del fixture canónico, sin repetir sus números a mano. */
function con(over: {
  cash_gap?: Partial<NonNullable<DashboardSummaryV2["cash_gap"]>> | null;
  cash_forecast?: Partial<NonNullable<DashboardSummaryV2["cash_forecast"]>> | null;
}): DashboardSummaryV2 {
  return {
    ...DEFICIT,
    cash_gap: over.cash_gap === null ? null : { ...DEFICIT.cash_gap!, ...over.cash_gap },
    cash_forecast:
      over.cash_forecast === null ? null : { ...DEFICIT.cash_forecast!, ...over.cash_forecast },
  } as DashboardSummaryV2;
}

describe("describeCashGap14d — el faltante es cash_gap_amount_14d, tal cual", () => {
  it("con el fixture DEFICIT publica 14.000.000: ni el saldo final (−10M) ni críticas menos caja", () => {
    expect(describeCashGap14d(DEFICIT)).toEqual({
      kind: "brecha",
      faltante: 14_000_000,
      minimo: -14_000_000,
      saldoFinal: -10_000_000,
      criticas: 34_800_000,
    });
  });

  it("CONTRAPESO · los números que publicaba la versión anterior NO salen", () => {
    const g = describeCashGap14d(DEFICIT);
    expect(g.kind).toBe("brecha");
    if (g.kind !== "brecha") return;
    expect(g.faltante).not.toBe(10_000_000); // −saldoFinal, lo que publicaba el caso "mixto"
    expect(g.faltante).not.toBe(44_800_000); // críticas menos saldo final (34,8M + 10M)
    expect(g.faltante).not.toBe(24_800_000); // críticas menos |saldo final|
  });

  it("el saldo final NO decide el monto: con cierre positivo la brecha sigue siendo la publicada", () => {
    /* Un cierre positivo no borra un valle intermedio (D03). La versión anterior habría hecho
       críticas − caja = 34,8M − 5M = 29,8M; el contrato dice 14M. */
    expect(describeCashGap14d(con({ cash_gap: { projected_cash_14d: "5000000" } }))).toEqual({
      kind: "brecha",
      faltante: 14_000_000,
      minimo: -14_000_000,
      saldoFinal: 5_000_000,
      criticas: 34_800_000,
    });
  });

  it("las obligaciones NO participan del monto: con críticas $0 la brecha publicada se conserva", () => {
    const g = describeCashGap14d(con({ cash_gap: { critical_obligations_14d: "0" } }));
    expect(g).toMatchObject({ kind: "brecha", faltante: 14_000_000, criticas: 0 });
  });
});

describe("describeCashGap14d — GEMELO POSITIVO: sin brecha", () => {
  it("cash_gap_amount_14d 0 con has_gap false → cubierto, no un negativo ni un $0 publicado", () => {
    expect(describeCashGap14d(NO_DEFICIT)).toEqual({ kind: "cubierto" });
  });

  it("has_gap false sin monto publicado sigue siendo cubierto: el backend lo dijo explícitamente", () => {
    expect(
      describeCashGap14d(
        con({ cash_gap: { has_gap: false, cash_gap_amount_14d: "" }, cash_forecast: null }),
      ),
    ).toEqual({ kind: "cubierto" });
  });

  it("CONTRAPESO · has_gap false con un monto positivo es contradicción: ni cubierto ni brecha", () => {
    expect(
      describeCashGap14d(
        con({
          cash_gap: { has_gap: false, cash_gap_amount_14d: "1" },
          cash_forecast: { min_14d: "1" },
        }),
      ),
    ).toMatchObject({ kind: "declared" });
  });
});

describe("describeCashGap14d — lo ausente no es cero", () => {
  it("brecha declarada sin monto (null / vacío / ilegible) → declared, nunca $0 ni un saldo", () => {
    for (const raw of [null, "", "  ", "n/a"]) {
      const cash_gap = { cash_gap_amount_14d: raw as unknown as string };
      expect(describeCashGap14d(con({ cash_gap }))).toEqual({
        kind: "declared",
        minimo: -14_000_000,
        saldoFinal: -10_000_000,
        criticas: 34_800_000,
      });
    }
  });

  it("brecha declarada con monto '0' → declared (has_gap y un $0 se contradicen)", () => {
    expect(describeCashGap14d(con({ cash_gap: { cash_gap_amount_14d: "0" } }))).toMatchObject({
      kind: "declared",
    });
  });

  it("sin bloque cash_gap ni mínimo → sin_dato, no cubierto", () => {
    expect(describeCashGap14d(null)).toEqual({ kind: "sin_dato" });
    expect(describeCashGap14d(undefined)).toEqual({ kind: "sin_dato" });
    expect(describeCashGap14d(con({ cash_gap: null, cash_forecast: null }))).toEqual({
      kind: "sin_dato",
    });
    expect(describeCashGap14d(con({ cash_gap: null, cash_forecast: { min_14d: "" } }))).toEqual({
      kind: "sin_dato",
    });
  });

  it("sin bloque cash_gap pero con mínimo bajo cero → declared (misma regla que resumenCaja)", () => {
    expect(describeCashGap14d(con({ cash_gap: null }))).toEqual({
      kind: "declared",
      minimo: -14_000_000,
      saldoFinal: null,
      criticas: null,
    });
  });

  it("las cifras de contexto que no vinieron quedan null, no cero", () => {
    expect(
      describeCashGap14d(
        con({
          cash_gap: { projected_cash_14d: "", critical_obligations_14d: null as unknown as string },
          cash_forecast: null,
        }),
      ),
    ).toEqual({
      kind: "brecha",
      faltante: 14_000_000,
      minimo: null,
      saldoFinal: null,
      criticas: null,
    });
  });

  it("has_gap ausente y mínimo no negativo → sin_dato: el backend no respondió", () => {
    expect(
      describeCashGap14d(
        con({
          cash_gap: { has_gap: null as unknown as boolean, cash_gap_amount_14d: "0" },
          cash_forecast: { min_14d: "1000" },
        }),
      ),
    ).toEqual({ kind: "sin_dato" });
  });
});
