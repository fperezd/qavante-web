import { describe, expect, it } from "vitest";
import {
  classifiedPct,
  confidencePct,
  confidenceTone,
  sortByAmountDesc,
  totalPending,
  type UnclassifiedMovement,
} from "./clasificar-v2-format";

const mv = (id: string, amount: string): UnclassifiedMovement => ({ id, date: "2026-07-01", glosa: `Mov ${id}`, amount });

describe("clasificar-v2-format", () => {
  it("confidenceTone por umbral", () => {
    expect(confidenceTone(0.9)).toBe("success");
    expect(confidenceTone(0.6)).toBe("warning");
    expect(confidenceTone(0.3)).toBe("danger");
    expect(confidenceTone(null)).toBe("neutral");
  });

  it("confidencePct redondea a %", () => {
    expect(confidencePct(0.855)).toBe("86%");
    expect(confidencePct(null)).toBe("—");
  });

  it("sortByAmountDesc ordena por monto absoluto", () => {
    const sorted = sortByAmountDesc([mv("a", "1000"), mv("b", "-5000000"), mv("c", "20000")]);
    expect(sorted.map((m) => m.id)).toEqual(["b", "c", "a"]);
  });

  it("totalPending suma montos absolutos", () => {
    expect(totalPending([mv("a", "1000"), mv("b", "-4000")])).toBe(5000);
  });

  it("classifiedPct = (total − pendientes) / total", () => {
    expect(classifiedPct(100, 43)).toBeCloseTo(57);
    expect(classifiedPct(0, 0)).toBe(0);
  });
});
