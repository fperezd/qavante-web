import { describe, it, expect } from "vitest";
import {
  parseAmount,
  pulsoStatusLabel,
  pulsoStatusTone,
  confidenceLabel,
  isEmptySummary,
} from "./dashboard-format";
import type { DashboardSummaryResponse } from "@/lib/api/dashboard";

const emptyData: DashboardSummaryResponse = {
  executive_phrase: null,
  pulso: null,
  cash_today: null,
  cash_forecast: null,
  cash_gap: null,
  overdue_collections: null,
  critical_payments: null,
  operational_result: null,
  priority_actions: null,
  generated_at: "2026-06-03T00:00:00Z",
};

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

describe("isEmptySummary", () => {
  it("true cuando todos los bloques son null (empresa nueva)", () => {
    expect(isEmptySummary(emptyData)).toBe(true);
  });
  it("true con priority_actions = [] (sin acciones)", () => {
    expect(isEmptySummary({ ...emptyData, priority_actions: [] })).toBe(true);
  });
  it("false si hay frase ejecutiva", () => {
    expect(isEmptySummary({ ...emptyData, executive_phrase: "Tu caja alcanza 6 semanas." })).toBe(
      false,
    );
  });
  it("false si algún bloque trae dato", () => {
    expect(
      isEmptySummary({
        ...emptyData,
        cash_today: { total: "100", last_updated: "2026-06-03T00:00:00Z", data_state: "available" },
      }),
    ).toBe(false);
  });
  it("false si hay al menos una acción prioritaria", () => {
    expect(
      isEmptySummary({
        ...emptyData,
        priority_actions: [
          { priority: 1, reason: "x", deadline: "hoy", cta_label: "Ver", cta_href: "/cobrar" },
        ],
      }),
    ).toBe(false);
  });
});
