import { describe, expect, it } from "vitest";
import { bheTotals, concentrationByEmisor, type BheItem } from "./bhe-v2-format";

const items: BheItem[] = [
  { rut_emisor: "12345678-9", nombre_emisor: "Ana Pérez", monto_bruto: 1000000, retencion: 137500, monto_liquido: 862500 },
  { rut_emisor: "98765432-1", nombre_emisor: "Luis Soto", monto_bruto: 600000, retencion: 82500, monto_liquido: 517500 },
  { rut_emisor: "12345678-9", nombre_emisor: "Ana Pérez", monto_bruto: 400000, retencion: 55000, monto_liquido: 345000 },
];

describe("bhe-v2-format", () => {
  it("bheTotals suma bruto/retención/líquido y cuenta", () => {
    const t = bheTotals(items);
    expect(t.count).toBe(3);
    expect(t.bruto).toBe(2000000);
    expect(t.retencion).toBe(275000);
    expect(t.liquido).toBe(1725000);
  });

  it("concentrationByEmisor agrupa por RUT y ordena desc", () => {
    const c = concentrationByEmisor(items, 5);
    expect(c[0]?.rut).toBe("12345678-9"); // 862500 + 345000 = 1.207.500
    expect(c[1]?.rut).toBe("98765432-1"); // 517.500
    expect((c[0]?.pct ?? 0) + (c[1]?.pct ?? 0)).toBeCloseTo(100);
  });
});
