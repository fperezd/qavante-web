import { describe, it, expect } from "vitest";
import {
  firstName,
  runwayDateLabel,
  obligationCoverageLabel,
  obligationCoverageTone,
  deltaPctLabel,
} from "./dashboard-format";

describe("firstName", () => {
  it("toma el primer término; vacío/nulo → ''", () => {
    expect(firstName("Fernando Pérez")).toBe("Fernando");
    expect(firstName("  Ana  ")).toBe("Ana");
    expect(firstName(null)).toBe("");
    expect(firstName("")).toBe("");
  });
});

describe("runwayDateLabel", () => {
  const from = new Date(2026, 5, 4); // 4 jun 2026 (local)
  it("suma los días y formatea en español", () => {
    expect(runwayDateLabel(14, from)).toBe("18 de junio");
    expect(runwayDateLabel(44, from)).toBe("18 de julio");
  });
  it("agrega el año solo si cae en otro año", () => {
    expect(runwayDateLabel(240, from)).toBe("30 de enero de 2027");
  });
  it("null/negativo/no-finito → null", () => {
    expect(runwayDateLabel(null, from)).toBeNull();
    expect(runwayDateLabel(-1, from)).toBeNull();
    expect(runwayDateLabel(undefined, from)).toBeNull();
  });
});

describe("obligationCoverageLabel / Tone", () => {
  it("mapea estado a etiqueta", () => {
    expect(obligationCoverageLabel("covered")).toBe("cubierto");
    expect(obligationCoverageLabel("tight")).toBe("ajustado");
    expect(obligationCoverageLabel("uncovered")).toBe("no alcanza");
    expect(obligationCoverageLabel("zzz")).toBe("—");
  });
  it("color: cubierto verde, ajustado warning, no-alcanza rojo", () => {
    expect(obligationCoverageTone("covered")).toContain("success");
    expect(obligationCoverageTone("tight")).toContain("warning");
    expect(obligationCoverageTone("uncovered")).toContain("danger");
    expect(obligationCoverageTone("zzz")).toContain("neutral");
  });
});

describe("deltaPctLabel", () => {
  it("flecha según signo; null si no hay dato", () => {
    expect(deltaPctLabel(8)).toBe("↑8%");
    expect(deltaPctLabel(-3)).toBe("↓3%");
    expect(deltaPctLabel(0)).toBe("↑0%");
    expect(deltaPctLabel(null)).toBeNull();
    expect(deltaPctLabel(undefined)).toBeNull();
  });
});
