import { describe, it, expect } from "vitest";
import {
  scoreBarWidth,
  sortDriversByImpact,
  impactLabel,
  isEmptyPulsoDetail,
} from "./pulso-detail-format";
import type { PulsoDetailResponse } from "@/lib/api/pulso";

const emptyDetail: PulsoDetailResponse = {
  score: 0,
  status: "stable",
  confidence: "low",
  preliminary: true,
  headline: null,
  components: [],
  drivers: [],
  trend: [],
  generated_at: "2026-06-03T00:00:00Z",
};

describe("scoreBarWidth", () => {
  it("convierte score a porcentaje y clampea 0–100", () => {
    expect(scoreBarWidth(68)).toBe("68%");
    expect(scoreBarWidth(-5)).toBe("0%");
    expect(scoreBarWidth(150)).toBe("100%");
    expect(scoreBarWidth(NaN)).toBe("0%");
  });
});

describe("sortDriversByImpact", () => {
  it("ordena alto → medio → bajo, sin mutar", () => {
    const input = [
      { impact: "low" as const, id: "a" },
      { impact: "high" as const, id: "b" },
      { impact: "medium" as const, id: "c" },
    ];
    const out = sortDriversByImpact(input);
    expect(out.map((d) => d.id)).toEqual(["b", "c", "a"]);
    expect(input.map((d) => d.id)).toEqual(["a", "b", "c"]); // no mutó
  });
});

describe("impactLabel", () => {
  it("mapea impacto a español; desconocido → medio", () => {
    expect(impactLabel("high")).toBe("impacto alto");
    expect(impactLabel("low")).toBe("impacto bajo");
    expect(impactLabel("zzz")).toBe("impacto medio");
  });
});

describe("isEmptyPulsoDetail", () => {
  it("true cuando no hay nada que mostrar", () => {
    expect(isEmptyPulsoDetail(emptyDetail)).toBe(true);
  });
  it("false si hay headline", () => {
    expect(isEmptyPulsoDetail({ ...emptyDetail, headline: "x" })).toBe(false);
  });
  it("false si hay componentes", () => {
    expect(
      isEmptyPulsoDetail({
        ...emptyDetail,
        components: [{ key: "k", label: "L", score: 50, weight: 1 }],
      }),
    ).toBe(false);
  });
  it("false si hay trend", () => {
    expect(isEmptyPulsoDetail({ ...emptyDetail, trend: [{ period: "may", score: 60 }] })).toBe(
      false,
    );
  });
});
