import { describe, expect, it } from "vitest";
import { titular } from "./caja-medidor";
import type { DiasCaja } from "./caja-dias-model";

/* `titular()` arma el headline + detalle del medidor de caja (issue #94, revisión adversarial
 * PR #107): el arreglo de `dLabel` — el helper interno que concuerda "1 día"/"N días" — vivía sin
 * NINGUNA cobertura que lo ejerciera. Este archivo cierra ese hueco probando `titular` en cada
 * rama que llama a `dLabel`, con N=1 y su gemelo positivo N≠1. */

const BASE: DiasCaja = {
  saldoHoy: 5_000_000,
  diasHastaMinimo: null,
  diasHastaCero: null,
  piso: null,
  diasRecuperacion: null,
  horizonteDias: 60,
  estado: "sano",
};

describe("titular — sobregiro, 'Recuperas tu mínimo en N día(s)'", () => {
  it("diasHastaRecuperar=1: singular 'día' (recuperar mañana es el caso más urgente, no de laboratorio)", () => {
    const r = titular(
      { ...BASE, saldoHoy: -200_000, estado: "critico", enSobregiro: true, diasHastaRecuperar: 1 },
      0,
    );
    expect(r.headline).toBe("Recuperas tu mínimo en ~1 día");
    expect(r.headline).not.toContain("1 días");
  });

  // [control positivo] gemelo N≠1: si un mutante forzara siempre el singular, este assert lo mata.
  it("[control positivo] diasHastaRecuperar=5: plural 'días'", () => {
    const r = titular(
      { ...BASE, saldoHoy: -200_000, estado: "critico", enSobregiro: true, diasHastaRecuperar: 5 },
      0,
    );
    expect(r.headline).toBe("Recuperas tu mínimo en ~5 días");
  });
});

describe("titular — 'Toca su punto más bajo en N día(s), te recuperas en M día(s)'", () => {
  it("piso.dia=1 y diasRecuperacion=1: singular en los DOS sitios de la misma frase", () => {
    const r = titular(
      {
        ...BASE,
        estado: "ajustado",
        diasHastaMinimo: 3,
        piso: { saldo: -100, dia: 1 },
        diasRecuperacion: 1,
      },
      0,
    );
    expect(r.detalle).toBe("Toca su punto más bajo en ~1 día, te recuperas en ~1 día.");
    expect(r.detalle).not.toContain("1 días");
  });

  // [control positivo] gemelo N≠1 para los dos sitios.
  it("[control positivo] piso.dia=10 y diasRecuperacion=20: plural en los dos", () => {
    const r = titular(
      {
        ...BASE,
        estado: "ajustado",
        diasHastaMinimo: 3,
        piso: { saldo: -100, dia: 10 },
        diasRecuperacion: 20,
      },
      0,
    );
    expect(r.detalle).toBe("Toca su punto más bajo en ~10 días, te recuperas en ~20 días.");
  });
});

describe("titular — crítico, 'Entras en rojo en N día(s)'", () => {
  it("diasHastaCero=1: singular 'día'", () => {
    const r = titular({ ...BASE, estado: "critico", diasHastaCero: 1 }, 0);
    expect(r.headline).toBe("Entras en rojo en ~1 día");
    expect(r.headline).not.toContain("1 días");
  });

  // [control positivo] gemelo N≠1.
  it("[control positivo] diasHastaCero=4: plural 'días'", () => {
    const r = titular({ ...BASE, estado: "critico", diasHastaCero: 4 }, 0);
    expect(r.headline).toBe("Entras en rojo en ~4 días");
  });
});

describe("titular — ajustado, 'Te alcanza N día(s)'", () => {
  it("diasHastaMinimo=1: singular 'día' (una caja que se acaba mañana, el escenario que este medidor existe para avisar)", () => {
    const r = titular({ ...BASE, estado: "ajustado", diasHastaMinimo: 1 }, 0);
    expect(r.headline).toBe("Te alcanza ~1 día");
    expect(r.headline).not.toContain("1 días");
  });

  // [control positivo] gemelo N≠1.
  it("[control positivo] diasHastaMinimo=14: plural 'días'", () => {
    const r = titular({ ...BASE, estado: "ajustado", diasHastaMinimo: 14 }, 0);
    expect(r.headline).toBe("Te alcanza ~14 días");
  });
});

describe("titular — sano, sin cifra (no pasa por concordancia)", () => {
  it("estado sano y piso sobre la mínima: 'Te alcanza de sobra', literal", () => {
    const r = titular({ ...BASE, estado: "sano" }, 0);
    expect(r.headline).toBe("Te alcanza de sobra");
  });

  it("horizonteDias=1: el detalle también usa singular", () => {
    const r = titular({ ...BASE, estado: "sano", horizonteDias: 1 }, 0);
    expect(r.detalle).toBe("No bajas de tu caja mínima en los próximos 1 día.");
    expect(r.detalle).not.toContain("1 días");
  });
});
