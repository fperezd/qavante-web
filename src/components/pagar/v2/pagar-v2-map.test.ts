import { describe, it, expect } from "vitest";
import {
  postergabilidadDe,
  montoCLP,
  mapVencimientos,
  mapFechasClave,
  mapConcentracion,
  mapBrecha,
} from "./pagar-v2-map";
import type { PayableItem, AccountsPayableResponse } from "@/lib/api/pagos";

const NOW = new Date(2026, 6, 14); // 14-jul-2026

const item = (over: Partial<PayableItem>): PayableItem =>
  ({
    label: "X",
    category: "supplier",
    due_date: "2026-07-20",
    amount: "1000",
    criticality: "medium",
    source: "SII",
    ...over,
  }) as PayableItem;

describe("postergabilidadDe", () => {
  it("impuestos/sueldos/deuda = no postergable", () => {
    expect(postergabilidadDe(item({ category: "tax" }))).toBe("no_postergable");
    expect(postergabilidadDe(item({ category: "payroll" }))).toBe("no_postergable");
    expect(postergabilidadDe(item({ category: "debt" }))).toBe("no_postergable");
  });
  it("baja criticidad = cubierto; resto = negociable", () => {
    expect(postergabilidadDe(item({ category: "supplier", criticality: "low" }))).toBe("cubierto");
    expect(postergabilidadDe(item({ category: "supplier", criticality: "medium" }))).toBe("negociable");
    expect(postergabilidadDe(item({ category: "rent", criticality: "high" }))).toBe("negociable");
  });
});

describe("montoCLP", () => {
  it("usa amount_clp si es moneda extranjera", () => {
    expect(montoCLP(item({ currency: "USD", amount: "1240", amount_clp: "1190000" }))).toBe(1_190_000);
  });
  it("usa amount si es CLP", () => {
    expect(montoCLP(item({ amount: "5000" }))).toBe(5000);
  });
});

describe("mapVencimientos", () => {
  it("pone el vencido primero y setea postergabilidad + USD de origen", () => {
    const items = [
      item({ label: "F29", category: "tax", due_date: "2026-07-20", amount: "4200000" }),
      item({ label: "Google", category: "supplier", due_date: "2026-07-10", amount: "1240", currency: "USD", amount_clp: "1190000", counterparty_name: "Google Cloud" }),
    ];
    const out = mapVencimientos(items, NOW);
    expect(out[0]?.vencido).toBe(true); // Google venció (10-jul)
    expect(out[0]?.acreedor).toBe("Google Cloud");
    expect(out[0]?.montoOrigen).toMatch(/US\$/);
    const f29 = out.find((v) => v.acreedor === "F29");
    expect(f29?.postergabilidad).toBe("no_postergable");
  });
});

describe("mapFechasClave", () => {
  it("arma imposiciones / impuestos / sueldos si están", () => {
    const items = [
      item({ label: "Cotizaciones Previred", category: "payroll", source: "Previred", amount: "3850000", due_date: "2026-07-13" }),
      item({ label: "IVA F29", category: "tax", amount: "4200000", due_date: "2026-07-20" }),
      item({ label: "Sueldos julio", category: "payroll", source: "Manual", amount: "8900000", due_date: "2026-07-30" }),
    ];
    const out = mapFechasClave(items, NOW);
    expect(out.map((f) => f.id)).toEqual(["imposiciones", "impuestos", "sueldos"]);
    expect(out[0]?.monto).toBe(3_850_000);
  });
});

describe("mapConcentracion", () => {
  it("agrupa por acreedor, ordena desc y calcula pct", () => {
    const items = [
      item({ counterparty_name: "KAUFMANN", amount: "2000000" }),
      item({ counterparty_name: "KAUFMANN", amount: "1000000" }),
      item({ counterparty_name: "DIVEIMPORT", amount: "1000000" }),
    ];
    const out = mapConcentracion(items);
    expect(out[0]).toEqual({ nombre: "KAUFMANN", rut: undefined, monto: 3_000_000, pct: 75 });
    expect(out[1]?.nombre).toBe("DIVEIMPORT");
  });
});

describe("mapBrecha", () => {
  it("caja proyectada vs (vencido + no-postergables ≤14d); postergable aparte", () => {
    const items = [
      item({ label: "prov vencido", category: "supplier", due_date: "2026-07-10", amount: "2000000" }), // vencido
      item({ label: "F29", category: "tax", due_date: "2026-07-20", amount: "4200000" }), // crítico ≤14d
      item({ label: "prov neg", category: "supplier", due_date: "2026-07-17", amount: "1000000" }), // negociable ≤14d
    ];
    const resp = { projected_cash_14d: "9400000" } as AccountsPayableResponse;
    const b = mapBrecha(resp, items, NOW);
    expect(b.cajaProyectada).toBe(9_400_000);
    expect(b.pagosCriticos).toBe(6_200_000); // 2M vencido + 4.2M F29
    expect(b.postergable).toBe(1_000_000);
  });
});
