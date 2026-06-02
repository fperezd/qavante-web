import { describe, it, expect } from "vitest";
import {
  parseAmount,
  pulsoStatusLabel,
  pulsoStatusTone,
  confidenceLabel,
} from "./dashboard-format";

describe("parseAmount", () => {
  it("string-decimal → number; vacío/inválido → 0", () => {
    expect(parseAmount("9800000")).toBe(9800000);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount("x")).toBe(0);
  });
});

describe("pulsoStatusLabel", () => {
  it("mapea estados a español", () => {
    expect(pulsoStatusLabel("critical")).toBe("Crítica");
    expect(pulsoStatusLabel("weak")).toBe("Débil");
    expect(pulsoStatusLabel("stable")).toBe("Estable");
    expect(pulsoStatusLabel("strong")).toBe("Sólida");
  });
  it("desconocido → 'Estable'", () => {
    expect(pulsoStatusLabel("nope")).toBe("Estable");
  });
});

describe("pulsoStatusTone", () => {
  it("crítico rojo, débil warning, sólido verde, otro brand", () => {
    expect(pulsoStatusTone("critical")).toContain("danger");
    expect(pulsoStatusTone("weak")).toContain("warning");
    expect(pulsoStatusTone("strong")).toContain("success");
    expect(pulsoStatusTone("stable")).toContain("brand");
  });
});

describe("confidenceLabel", () => {
  it("mapea confianza", () => {
    expect(confidenceLabel("high")).toBe("confianza alta");
    expect(confidenceLabel("low")).toBe("confianza baja");
    expect(confidenceLabel("zzz")).toBe("confianza media");
  });
});
