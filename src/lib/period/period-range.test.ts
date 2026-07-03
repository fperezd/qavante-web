import { describe, expect, it } from "vitest";
import {
  addMonths,
  defaultRange,
  expandPeriodRange,
  formatMonthLabel,
  formatRangeLabel,
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
  it("defaultRange = últimos 6 meses", () => {
    expect(defaultRange(NOW)).toEqual({ desde: "2026-02", hasta: "2026-07" });
  });
  it("matchingPreset detecta el chip activo", () => {
    expect(matchingPreset({ desde: "2026-02", hasta: "2026-07" }, NOW)).toBe("seis_meses");
    expect(matchingPreset({ desde: "2026-04", hasta: "2026-06" }, NOW)).toBeNull();
  });
});

describe("period-range · labels", () => {
  it("formatMonthLabel y formatRangeLabel", () => {
    expect(formatMonthLabel("2026-02")).toBe("feb-2026");
    expect(formatRangeLabel({ desde: "2026-02", hasta: "2026-07" })).toBe("feb-2026 a jul-2026");
    expect(formatRangeLabel({ desde: "2026-03", hasta: "2026-03" })).toBe("mar-2026");
  });
});
