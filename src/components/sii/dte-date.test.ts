import { describe, expect, it } from "vitest";
import { toIsoDate, fechaToPeriodo, monthBounds, periodToPdfWindow } from "./dte-date";

describe("dte-date · toIsoDate", () => {
  it("normaliza los formatos del SII a YYYY-MM-DD", () => {
    expect(toIsoDate("2026-02-26")).toBe("2026-02-26");
    expect(toIsoDate("2026-02-26T10:00:00Z")).toBe("2026-02-26");
    expect(toIsoDate("26/02/2026")).toBe("2026-02-26");
    expect(toIsoDate("26-02-2026")).toBe("2026-02-26");
    expect(toIsoDate("26.02.2026")).toBe("2026-02-26");
    expect(toIsoDate("5/3/2026")).toBe("2026-03-05"); // padding
  });
  it("null/vacío/no-parseable → null", () => {
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("marzo 2026")).toBeNull();
  });
});

describe("dte-date · fechaToPeriodo", () => {
  it("YYYY-MM de la fecha", () => {
    expect(fechaToPeriodo("26/02/2026")).toBe("2026-02");
    expect(fechaToPeriodo("2026-05-31")).toBe("2026-05");
    expect(fechaToPeriodo("basura")).toBeNull();
  });
});

describe("dte-date · monthBounds", () => {
  it("primer y último día del mes (incl. bisiesto y meses de 30/31)", () => {
    expect(monthBounds("15/02/2026")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(monthBounds("15/02/2028")).toEqual({ desde: "2028-02-01", hasta: "2028-02-29" }); // bisiesto
    expect(monthBounds("2026-04-10")).toEqual({ desde: "2026-04-01", hasta: "2026-04-30" });
    expect(monthBounds("2026-12-01")).toEqual({ desde: "2026-12-01", hasta: "2026-12-31" });
  });
  it("no parseable → null", () => {
    expect(monthBounds("x")).toBeNull();
    expect(monthBounds(null)).toBeNull();
  });
});

describe("dte-date · periodToPdfWindow", () => {
  it("rango YYYY-MM_YYYY-MM → primer día del primer mes, último del último", () => {
    expect(periodToPdfWindow("2026-02_2026-07")).toEqual({
      desde: "2026-02-01",
      hasta: "2026-07-31",
    });
    // Rango que cruza fin de año + febrero bisiesto en el extremo.
    expect(periodToPdfWindow("2028-01_2028-02")).toEqual({
      desde: "2028-01-01",
      hasta: "2028-02-29",
    });
  });
  it("mes suelto YYYY-MM → ese mes completo", () => {
    expect(periodToPdfWindow("2026-04")).toEqual({ desde: "2026-04-01", hasta: "2026-04-30" });
  });
  it("vacío/no parseable → null", () => {
    expect(periodToPdfWindow(null)).toBeNull();
    expect(periodToPdfWindow("")).toBeNull();
    expect(periodToPdfWindow("basura")).toBeNull();
  });
});
