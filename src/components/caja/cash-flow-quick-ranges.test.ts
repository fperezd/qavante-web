import { describe, expect, it } from "vitest";
import { cashFlowQuickRanges, matchCashFlowQuickRange } from "./cash-flow-format";

/* Atajos de período del reporte de caja. Lo que se fija acá es lo que los hace útiles y no
   peligrosos: que ninguno se extienda a meses futuros (es una lectura de lo que YA pasó, y un
   mes que todavía no termina sumaría un período incompleto como si estuviera cerrado), y que
   la granularidad acompañe al largo del rango en vez de dejar 180 columnas diarias. */

const HOY = new Date(2026, 9, 2); // 02-10-2026

describe("cashFlowQuickRanges", () => {
  it("ninguno se extiende más allá del mes en curso", () => {
    for (const range of cashFlowQuickRanges(HOY)) {
      expect(range.period_to).toBe("2026-10");
      expect(range.period_from <= range.period_to).toBe(true);
    }
  });

  it("cada rango parte donde corresponde", () => {
    const porClave = Object.fromEntries(cashFlowQuickRanges(HOY).map((r) => [r.key, r]));

    expect(porClave.mes?.period_from).toBe("2026-10");
    expect(porClave.trimestre?.period_from).toBe("2026-08");
    expect(porClave.semestre?.period_from).toBe("2026-05");
    expect(porClave.anio?.period_from).toBe("2026-01");
  });

  it("la granularidad crece con el largo del rango", () => {
    const porClave = Object.fromEntries(cashFlowQuickRanges(HOY).map((r) => [r.key, r]));

    expect(porClave.mes?.granularity).toBe("day");
    expect(porClave.trimestre?.granularity).toBe("week");
    expect(porClave.semestre?.granularity).toBe("month");
    expect(porClave.anio?.granularity).toBe("month");
  });

  it("cruza el año sin inventar meses: en enero el trimestre arranca en noviembre anterior", () => {
    const enero = new Date(2027, 0, 15);
    const porClave = Object.fromEntries(cashFlowQuickRanges(enero).map((r) => [r.key, r]));

    expect(porClave.trimestre?.period_from).toBe("2026-11");
    expect(porClave.trimestre?.period_to).toBe("2027-01");
    expect(porClave.anio?.period_from).toBe("2027-01");
  });
});

describe("matchCashFlowQuickRange", () => {
  it("reconoce el atajo exacto", () => {
    expect(
      matchCashFlowQuickRange(
        { period_from: "2026-08", period_to: "2026-10", granularity: "week" },
        HOY,
      ),
    ).toBe("trimestre");
  });

  it("un rango armado a mano no se hace pasar por atajo", () => {
    expect(
      matchCashFlowQuickRange(
        { period_from: "2026-04", period_to: "2026-09", granularity: "week" },
        HOY,
      ),
    ).toBeNull();
  });

  it("el mismo rango con otra granularidad no es el atajo", () => {
    expect(
      matchCashFlowQuickRange(
        { period_from: "2026-08", period_to: "2026-10", granularity: "day" },
        HOY,
      ),
    ).toBeNull();
  });
});
