import { describe, it, expect } from "vitest";
import {
  isPulsoObjetivo,
  objetivoOption,
  readPulsoObjetivo,
  withPulsoObjetivo,
  DEFAULT_OBJETIVO,
  PULSO_OBJETIVO_KEY,
} from "./pulso-objetivo";

describe("isPulsoObjetivo", () => {
  it("acepta solo objetivos conocidos", () => {
    expect(isPulsoObjetivo("cuidar_caja")).toBe(true);
    expect(isPulsoObjetivo("equilibrado")).toBe(true);
    expect(isPulsoObjetivo("crecer")).toBe(true);
    expect(isPulsoObjetivo("otro")).toBe(false);
    expect(isPulsoObjetivo(42)).toBe(false);
    expect(isPulsoObjetivo(null)).toBe(false);
    expect(isPulsoObjetivo(undefined)).toBe(false);
  });
});

describe("objetivoOption", () => {
  it("devuelve label + descripcion del objetivo", () => {
    expect(objetivoOption("cuidar_caja").label).toBe("Cuidar la caja");
    expect(objetivoOption("cumplir_pagos").descripcion).toMatch(/obligaciones/i);
  });
});

describe("readPulsoObjetivo", () => {
  it("lee el objetivo guardado", () => {
    expect(readPulsoObjetivo({ [PULSO_OBJETIVO_KEY]: "crecer" })).toBe("crecer");
  });
  it("cae al default con blob ausente / clave ausente / valor desconocido", () => {
    expect(readPulsoObjetivo(undefined)).toBe(DEFAULT_OBJETIVO);
    expect(readPulsoObjetivo({})).toBe(DEFAULT_OBJETIVO);
    expect(readPulsoObjetivo({ [PULSO_OBJETIVO_KEY]: "inventado" })).toBe(DEFAULT_OBJETIVO);
    expect(readPulsoObjetivo({ [PULSO_OBJETIVO_KEY]: 5 })).toBe(DEFAULT_OBJETIVO);
  });
});

describe("withPulsoObjetivo", () => {
  it("mete el objetivo preservando el resto del blob (reemplaza, no merge)", () => {
    const blob = { inicio_widget_order: ["caja", "cobranza"], otra: 1 };
    const next = withPulsoObjetivo(blob, "cuidar_caja");
    expect(next[PULSO_OBJETIVO_KEY]).toBe("cuidar_caja");
    expect(next.inicio_widget_order).toEqual(["caja", "cobranza"]);
    expect(next.otra).toBe(1);
  });
  it("pisa el objetivo previo sin tocar lo demás", () => {
    const next = withPulsoObjetivo({ [PULSO_OBJETIVO_KEY]: "crecer", x: true }, "equilibrado");
    expect(next[PULSO_OBJETIVO_KEY]).toBe("equilibrado");
    expect(next.x).toBe(true);
  });
  it("funciona con blob undefined", () => {
    expect(withPulsoObjetivo(undefined, "crecer")).toEqual({ [PULSO_OBJETIVO_KEY]: "crecer" });
  });
});
