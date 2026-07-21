import { describe, it, expect } from "vitest";
import { cruceDias, diasDeCaja, datosSuficientes, diasParaAguja } from "./caja-dias-model";
import type { SaldoPunto } from "./caja-curva-model";

const s = (saldos: number[]): SaldoPunto[] => saldos.map((v, i) => ({ label: `p${i}`, saldo: v }));

describe("cruceDias", () => {
  it("interpola el cruce del umbral dentro del tramo (semanal → días)", () => {
    // hoy 6, luego 4, luego 1: cruza 2 entre el punto 1 (4) y el 2 (1): t=(4-2)/(4-1)=0.666…
    // días = (1 + 0.666…) * 7 = 11.66…
    const d = cruceDias(s([6, 4, 1]), 2, 7);
    expect(d).toBeCloseTo((1 + 2 / 3) * 7, 5);
  });
  it("0 si ya está bajo el umbral hoy", () => {
    expect(cruceDias(s([-1, 2, 3]), 0, 7)).toBe(0);
  });
  it("null si nunca cruza", () => {
    expect(cruceDias(s([6, 5, 4]), 0, 7)).toBeNull();
  });
});

describe("diasDeCaja", () => {
  it("null sin ≥2 puntos", () => {
    expect(diasDeCaja(s([5]), 2)).toBeNull();
  });
  it("caja sana: nunca toca la mínima → estado sano, sin cruces", () => {
    const m = diasDeCaja(s([10, 9, 8, 9]), 2)!;
    expect(m.estado).toBe("sano");
    expect(m.diasHastaMinimo).toBeNull();
    expect(m.diasHastaCero).toBeNull();
  });
  it("ajustado: cruza la mínima pero no el $0", () => {
    const m = diasDeCaja(s([6, 4, 1.5, 2.5]), 2)!; // baja a 1.5 (< 2) sin tocar 0
    expect(m.estado).toBe("ajustado");
    expect(m.diasHastaMinimo).not.toBeNull();
    expect(m.diasHastaCero).toBeNull();
  });
  it("critico: cae bajo $0", () => {
    const m = diasDeCaja(s([6, 2, -1, 3]), 2)!;
    expect(m.estado).toBe("critico");
    expect(m.diasHastaCero).not.toBeNull();
  });
  it("piso = saldo más bajo + su día; recuperación tras el piso", () => {
    const m = diasDeCaja(s([6, 2, -1, 0.5, 3]), 2, 7)!; // piso -1 en idx 2 (día 14); recupera ≥2 en idx 4 (día 28)
    expect(m.piso).toEqual({ saldo: -1, dia: 14 });
    expect(m.diasRecuperacion).toBe(28);
    expect(m.horizonteDias).toBe(28);
  });
  it("sin mínima configurada usa $0 como referencia (nunca 'ajustado')", () => {
    const m = diasDeCaja(s([6, 4, 2, 1]), null)!; // baja a 1 pero no toca 0
    expect(m.estado).toBe("sano");
    expect(m.diasHastaMinimo).toBe(m.diasHastaCero); // misma referencia $0
  });
  it("saldo hoy ya negativo → critico y 0 días", () => {
    const m = diasDeCaja(s([-2, -1, 1]), 2)!;
    expect(m.estado).toBe("critico");
    expect(m.diasHastaMinimo).toBe(0);
  });
});

describe("datosSuficientes", () => {
  it("false con <3 puntos o sin movimiento", () => {
    expect(datosSuficientes(s([5, 6]), 100)).toBe(false);
    expect(datosSuficientes(s([5, 6, 7]), 0)).toBe(false);
  });
  it("true con ≥3 puntos y movimiento material", () => {
    expect(datosSuficientes(s([5, 6, 7]), 100)).toBe(true);
  });
});

describe("diasParaAguja", () => {
  it("usa días hasta mínima; tope si nunca la toca; acota a [0,max]", () => {
    const sano = diasDeCaja(s([10, 9, 8, 9]), 2)!;
    expect(diasParaAguja(sano, 60)).toBe(sano.horizonteDias); // nunca toca → horizonte
    const ajust = diasDeCaja(s([6, 4, 1.5, 2.5]), 2)!;
    expect(diasParaAguja(ajust, 60)).toBeCloseTo(ajust.diasHastaMinimo!, 5);
    expect(diasParaAguja(ajust, 5)).toBe(5); // acotado al max
  });
});
