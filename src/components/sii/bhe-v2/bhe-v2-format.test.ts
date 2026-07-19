import { describe, expect, it } from "vitest";
import {
  bheTotals,
  concentrationByEmisor,
  retencionHonorariosPct,
  retencionHonorariosLabel,
  anioDePeriodo,
} from "./bhe-v2-format";
import type { BheRecibida } from "@/lib/api/sii";

function bhe(p: Partial<BheRecibida>): BheRecibida {
  return {
    fecha_emision: "2026-06-05",
    nombre_emisor: "Pro",
    rut_emisor: "12345678-9",
    folio: 1,
    monto_bruto: 1000000,
    retencion: 137500,
    monto_liquido: 862500,
    anulada: false,
    ...p,
  } as BheRecibida;
}

describe("bhe-v2-format · bheTotals", () => {
  it("suma bruto/retención/líquido y cuenta boletas", () => {
    const t = bheTotals([
      bhe({}),
      bhe({ monto_bruto: 500000, retencion: 68750, monto_liquido: 431250 }),
    ]);
    expect(t.count).toBe(2);
    expect(t.bruto).toBe(1500000);
    expect(t.retencion).toBe(206250);
    expect(t.liquido).toBe(1293750);
  });
  it("las anuladas NO cuentan (la retención se revierte)", () => {
    const t = bheTotals([
      bhe({}),
      bhe({ anulada: true, monto_bruto: 9, retencion: 9, monto_liquido: 9 }),
    ]);
    expect(t.count).toBe(1);
    expect(t.retencion).toBe(137500);
  });
});

describe("bhe-v2-format · concentrationByEmisor", () => {
  it("agrupa por RUT por líquido, ordenado desc, excluye anuladas", () => {
    const items = [
      bhe({ rut_emisor: "1-9", nombre_emisor: "A", monto_liquido: 300000 }),
      bhe({ rut_emisor: "2-7", nombre_emisor: "B", monto_liquido: 700000 }),
      bhe({ rut_emisor: "1-9", nombre_emisor: "A", monto_liquido: 100000 }),
      bhe({ rut_emisor: "3-5", nombre_emisor: "C", anulada: true, monto_liquido: 999999 }),
    ];
    const c = concentrationByEmisor(items, 5);
    expect(c.map((x) => x.rut)).toEqual(["2-7", "1-9"]); // B 700k, A 400k; C anulada fuera
    expect((c[0]?.pct ?? 0) + (c[1]?.pct ?? 0)).toBeCloseTo(100);
  });
  it("no funde profesionales distintos sin RUT (keyea por nombre)", () => {
    const c = concentrationByEmisor([
      bhe({ rut_emisor: undefined, nombre_emisor: "Ana", monto_liquido: 100 }),
      bhe({ rut_emisor: undefined, nombre_emisor: "Beto", monto_liquido: 200 }),
    ]);
    expect(c).toHaveLength(2);
  });
});

describe("bhe-v2-format · retención de honorarios (Ley 21.133)", () => {
  it("tasa por año del aumento gradual", () => {
    expect(retencionHonorariosPct(2024)).toBe(13.75);
    expect(retencionHonorariosPct(2025)).toBe(14.5);
    expect(retencionHonorariosPct(2026)).toBe(15.25);
    expect(retencionHonorariosPct(2027)).toBe(16);
  });
  it("tope 17% desde 2028", () => {
    expect(retencionHonorariosPct(2028)).toBe(17);
    expect(retencionHonorariosPct(2030)).toBe(17);
  });
  it("label en formato chileno con el año", () => {
    expect(retencionHonorariosLabel(2026)).toBe("15,25% (2026)");
    expect(retencionHonorariosLabel(2027)).toBe("16% (2027)");
  });
  it("anioDePeriodo parsea YYYY-MM o cae al fallback", () => {
    expect(anioDePeriodo("2026-07", 2000)).toBe(2026);
    expect(anioDePeriodo(undefined, 2026)).toBe(2026);
    expect(anioDePeriodo("basura", 2026)).toBe(2026);
  });
});
