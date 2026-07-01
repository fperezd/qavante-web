import { describe, expect, it } from "vitest";
import {
  concentrationPct,
  dsoTrend,
  priorityTone,
  urgencyScore,
} from "./cobranza-v2-format";

describe("cobranza-v2-format", () => {
  it("urgencyScore = saldo × días de mora (0 si no vencido)", () => {
    expect(urgencyScore("1000000", 30)).toBe(30000000);
    expect(urgencyScore("5000000", -5)).toBe(0); // aún no vence
  });

  it("priorityTone por días de mora", () => {
    expect(priorityTone(-3).label).toBe("Por vencer");
    expect(priorityTone(5).label).toBe("Baja");
    expect(priorityTone(30).label).toBe("Media");
    expect(priorityTone(90)).toEqual({ tone: "danger", label: "Alta" });
  });

  it("concentrationPct suma los top-N sobre el total", () => {
    // top3 de [50,30,10,5,5] = 90 sobre total 100 = 90%
    expect(concentrationPct(["50", "30", "10", "5", "5"], "100", 3)).toBeCloseTo(90);
    expect(concentrationPct([], "0")).toBe(0);
  });

  it("dsoTrend: subir es malo (danger), bajar es bueno (success)", () => {
    expect(dsoTrend(52, 45)).toEqual({ tone: "danger", deltaDays: 7 });
    expect(dsoTrend(40, 45)).toEqual({ tone: "success", deltaDays: -5 });
    expect(dsoTrend(null, 45).tone).toBe("neutral");
  });
});
