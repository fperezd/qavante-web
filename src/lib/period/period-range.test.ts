import { describe, expect, it } from "vitest";
import {
  addMonths,
  defaultRange,
  expandPeriodRange,
  formatMonthLabel,
  formatRangeLabel,
  isInPeriodRange,
  matchingPreset,
  orderRange,
  presetRange,
  toPeriod,
} from "./period-range";

const NOW = new Date(Date.UTC(2026, 6, 15)); // 2026-07-15

describe("period-range · aritmética", () => {
  it("toPeriod y addMonths (cruza año)", () => {
    expect(toPeriod(NOW)).toBe("2026-07");
    expect(addMonths("2026-07", -5)).toBe("2026-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("orderRange swapea si viene al revés", () => {
    expect(orderRange({ desde: "2026-07", hasta: "2026-02" })).toEqual({
      desde: "2026-02",
      hasta: "2026-07",
    });
  });

  it("expandPeriodRange lista meses inclusive, de viejo a nuevo", () => {
    expect(expandPeriodRange({ desde: "2026-02", hasta: "2026-05" })).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
    ]);
    expect(expandPeriodRange({ desde: "2026-03", hasta: "2026-03" })).toEqual(["2026-03"]);
  });

  it("expandPeriodRange respeta el cap de meses", () => {
    expect(expandPeriodRange({ desde: "2020-01", hasta: "2030-01" }, 12)).toHaveLength(12);
  });
  it("al exceder el cap conserva los meses MÁS RECIENTES (incluye hasta, no desde)", () => {
    const out = expandPeriodRange({ desde: "2020-01", hasta: "2026-12" }, 24);
    expect(out).toHaveLength(24);
    expect(out[out.length - 1]).toBe("2026-12"); // el extremo reciente se conserva
    expect(out[0]).toBe("2025-01"); // arranca en hasta-23, no en 2020-01
    expect(out).not.toContain("2020-01"); // el mes viejo se descarta, no el reciente
  });
});

describe("period-range · presets", () => {
  it("tres/seis meses relativos a now", () => {
    expect(presetRange("tres_meses", NOW)).toEqual({ desde: "2026-05", hasta: "2026-07" });
    expect(presetRange("seis_meses", NOW)).toEqual({ desde: "2026-02", hasta: "2026-07" });
  });
  it("este año / año anterior", () => {
    expect(presetRange("este_ano", NOW)).toEqual({ desde: "2026-01", hasta: "2026-07" });
    expect(presetRange("ano_anterior", NOW)).toEqual({ desde: "2025-01", hasta: "2025-12" });
  });
  it("mes actual = un solo mes (desde === hasta)", () => {
    expect(presetRange("mes_actual", NOW)).toEqual({ desde: "2026-07", hasta: "2026-07" });
    expect(matchingPreset({ desde: "2026-07", hasta: "2026-07" }, NOW)).toBe("mes_actual");
  });
  it("mes anterior = el mes previo (cruza año)", () => {
    expect(presetRange("mes_anterior", NOW)).toEqual({ desde: "2026-06", hasta: "2026-06" });
    expect(matchingPreset({ desde: "2026-06", hasta: "2026-06" }, NOW)).toBe("mes_anterior");
    // Enero → diciembre del año anterior.
    const ENERO = new Date(Date.UTC(2026, 0, 15));
    expect(presetRange("mes_anterior", ENERO)).toEqual({ desde: "2025-12", hasta: "2025-12" });
  });
  it("defaultRange = últimos 6 meses", () => {
    expect(defaultRange(NOW)).toEqual({ desde: "2026-02", hasta: "2026-07" });
  });
  it("matchingPreset detecta el chip activo", () => {
    expect(matchingPreset({ desde: "2026-02", hasta: "2026-07" }, NOW)).toBe("seis_meses");
    expect(matchingPreset({ desde: "2026-04", hasta: "2026-06" }, NOW)).toBeNull();
  });
});

describe("period-range · isInPeriodRange", () => {
  const range = { desde: "2026-02", hasta: "2026-07" };
  it("incluye los meses del rango (inclusive)", () => {
    expect(isInPeriodRange("2026-02-01", range)).toBe(true);
    expect(isInPeriodRange("2026-07-31", range)).toBe(true);
    expect(isInPeriodRange("2026-04-15T10:00:00Z", range)).toBe(true);
  });
  it("excluye fuera del rango", () => {
    expect(isInPeriodRange("2026-01-31", range)).toBe(false);
    expect(isInPeriodRange("2026-08-01", range)).toBe(false);
  });
  it("null/vacío → false", () => {
    expect(isInPeriodRange(null, range)).toBe(false);
    expect(isInPeriodRange("", range)).toBe(false);
  });
});

describe("period-range · labels", () => {
  it("formatMonthLabel y formatRangeLabel", () => {
    expect(formatMonthLabel("2026-02")).toBe("feb-2026");
    expect(formatRangeLabel({ desde: "2026-02", hasta: "2026-07" })).toBe("feb-2026 a jul-2026");
    expect(formatRangeLabel({ desde: "2026-03", hasta: "2026-03" })).toBe("mar-2026");
  });
});
