import { describe, it, expect } from "vitest";
import type { DocConVencimiento } from "@/components/terminos/terminos-pago";
import {
  montoFirmado,
  periodoDe,
  agregarContrapartes,
  serieMensual,
  tendenciaAnual,
  estacionalidad,
  concentracionPct,
  type PuntoMes,
} from "./contraparte-360-model";

const doc = (over: Partial<DocConVencimiento>): DocConVencimiento => ({
  rut: "76111222-3",
  name: "Cliente X",
  fecha: "15/03/2026",
  monto: 1_000_000,
  tipoDoc: 33,
  ...over,
});

describe("montoFirmado", () => {
  it("factura suma; NC (61/112) resta; reclamado no cuenta", () => {
    expect(montoFirmado(doc({ monto: 1_000_000, tipoDoc: 33 }))).toBe(1_000_000);
    expect(montoFirmado(doc({ monto: 300_000, tipoDoc: 61 }))).toBe(-300_000);
    expect(montoFirmado(doc({ monto: 500_000, tipoDoc: 112 }))).toBe(-500_000);
    expect(montoFirmado(doc({ monto: 900_000, reclamado: true }))).toBe(0);
  });
});

describe("periodoDe", () => {
  it("DD/MM/YYYY e ISO → YYYY-MM; basura → null", () => {
    expect(periodoDe("15/03/2026")).toBe("2026-03");
    expect(periodoDe("2026-03-15")).toBe("2026-03");
    expect(periodoDe("nope")).toBeNull();
  });
});

describe("agregarContrapartes", () => {
  it("netea NC, cuenta docs, primer/último mes y ordena por total desc", () => {
    const docs = [
      doc({ rut: "1-9", name: "Grande", monto: 5_000_000, fecha: "10/01/2026" }),
      doc({ rut: "1-9", name: "Grande", monto: 1_000_000, tipoDoc: 61, fecha: "10/02/2026" }), // NC
      doc({ rut: "2-7", name: "Chico", monto: 800_000, fecha: "05/03/2026" }),
    ];
    const out = agregarContrapartes(docs);
    expect(out.map((c) => c.rut)).toEqual(["1-9", "2-7"]); // Grande primero (4M > 0.8M)
    expect(out[0]).toMatchObject({
      total: 4_000_000,
      docs: 2,
      primerPeriodo: "2026-01",
      ultimoPeriodo: "2026-02",
    });
  });
});

describe("serieMensual", () => {
  it("rellena meses sin movimiento con 0 y netea por mes", () => {
    const docs = [
      doc({ rut: "1-9", monto: 1_000_000, fecha: "10/01/2026" }),
      doc({ rut: "1-9", monto: 400_000, fecha: "20/03/2026" }),
      doc({ rut: "9-9", monto: 999, fecha: "10/02/2026" }), // otro rut → se ignora
    ];
    const s = serieMensual(docs, "1-9", "2026-01", "2026-03");
    expect(s).toEqual([
      { periodo: "2026-01", monto: 1_000_000 },
      { periodo: "2026-02", monto: 0 },
      { periodo: "2026-03", monto: 400_000 },
    ]);
  });
});

describe("tendenciaAnual", () => {
  const serie24 = (montos: number[]): PuntoMes[] =>
    montos.map((m, i) => ({ periodo: `p${i}`, monto: m }));

  it("compara últimos 12 vs previos 12", () => {
    // previos 12 = 12×100 = 1200; últimos 12 = 12×150 = 1800 → +50%
    const s = serie24([...Array(12).fill(100), ...Array(12).fill(150)]);
    const t = tendenciaAnual(s)!;
    expect(t.previos12).toBe(1200);
    expect(t.ultimos12).toBe(1800);
    expect(t.deltaPct).toBeCloseTo(50, 5);
  });

  it("menos de 24 meses → null (sin dos años no compara)", () => {
    expect(tendenciaAnual(serie24(Array(12).fill(100)))).toBeNull();
  });

  it("los 12 previos sin actividad (cliente nuevo) → null (no compara contra $0)", () => {
    // 24 meses pero los primeros 12 en cero → no existía la relación hace un año.
    const s = serie24([...Array(12).fill(0), ...Array(12).fill(150)]);
    expect(tendenciaAnual(s)).toBeNull();
  });
});

describe("estacionalidad", () => {
  it("promedia por mes de calendario sobre los años de la serie", () => {
    const s: PuntoMes[] = [
      { periodo: "2025-01", monto: 100 },
      { periodo: "2026-01", monto: 300 }, // enero: promedio 200
      { periodo: "2025-07", monto: 50 },
    ];
    const est = estacionalidad(s);
    expect(est).toHaveLength(12);
    expect(est.find((e) => e.mes === 1)!.promedio).toBe(200);
    expect(est.find((e) => e.mes === 7)!.promedio).toBe(50);
    expect(est.find((e) => e.mes === 5)!.promedio).toBe(0); // sin datos
  });
});

describe("concentracionPct", () => {
  it("% del total; null si no hay total", () => {
    expect(concentracionPct(30, 120)).toBe(25);
    expect(concentracionPct(10, 0)).toBeNull();
  });
});
