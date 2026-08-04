import { describe, expect, it } from "vitest";
import {
  daysUntilDue,
  isOverdue,
  overdueTotal,
  subtotalsByCriticality,
  overdueThenCritical,
} from "./pagos-v2-format";
import type { PayableItem } from "@/lib/api/pagos";

const NOW = new Date("2026-07-06T15:00:00Z");

function item(p: Partial<PayableItem>): PayableItem {
  return {
    label: "x",
    category: "supplier",
    due_date: "2026-07-10",
    amount: "1000",
    criticality: "low",
    source: "SII",
    ...p,
  } as PayableItem;
}

describe("pagos-v2-format · daysUntilDue", () => {
  it("cuenta días por día calendario (no por hora)", () => {
    expect(daysUntilDue("2026-07-06", NOW)).toBe(0); // hoy
    expect(daysUntilDue("2026-07-10", NOW)).toBe(4);
    expect(daysUntilDue("2026-07-01", NOW)).toBe(-5); // vencido
  });
  it("fecha nula/inválida → null", () => {
    expect(daysUntilDue(null, NOW)).toBeNull();
    expect(daysUntilDue("basura", NOW)).toBeNull();
  });
  it("tolera fechas no-padded del backend (2026-7-5)", () => {
    expect(daysUntilDue("2026-7-6", NOW)).toBe(0);
    expect(daysUntilDue("2026-7-1", NOW)).toBe(-5);
  });
});

describe("pagos-v2-format · vencido", () => {
  it("isOverdue: solo fechas pasadas", () => {
    expect(isOverdue(item({ due_date: "2026-07-01" }), NOW)).toBe(true);
    expect(isOverdue(item({ due_date: "2026-07-06" }), NOW)).toBe(false); // hoy no está vencido
    expect(isOverdue(item({ due_date: "2026-07-20" }), NOW)).toBe(false);
  });
  it("overdueTotal suma solo lo vencido", () => {
    const items = [
      item({ due_date: "2026-07-01", amount: "5000" }),
      item({ due_date: "2026-07-02", amount: "3000" }),
      item({ due_date: "2026-07-20", amount: "9999" }),
    ];
    expect(overdueTotal(items, NOW)).toBe(8000);
  });
  it("overdueTotal usa el CLP de una extranjera (no su nominal) y omite la que no tiene amount_clp", () => {
    const items = [
      item({ due_date: "2026-07-01", amount: "1000", currency: "CLP" }), // 1000
      // US$1.240 vencido → cuenta su amount_clp ($1.178.000), NO el nominal 1240.
      item({ due_date: "2026-07-01", amount: "1240", currency: "USD", amount_clp: "1178000" }),
      // extranjera SIN amount_clp → aporta 0 (no se inventa 500 pesos).
      item({ due_date: "2026-07-01", amount: "500", currency: "USD", amount_clp: null }),
    ];
    expect(overdueTotal(items, NOW)).toBe(1_179_000);
  });
});

describe("pagos-v2-format · subtotalsByCriticality", () => {
  it("suma por nivel", () => {
    const items = [
      item({ criticality: "high", amount: "1000" }),
      item({ criticality: "high", amount: "500" }),
      item({ criticality: "medium", amount: "200" }),
    ];
    expect(subtotalsByCriticality(items)).toEqual({ high: 1500, medium: 200, low: 0 });
  });
});

describe("pagos-v2-format · overdueThenCritical", () => {
  it("vencido primero, luego por criticidad, luego por fecha", () => {
    const items = [
      item({ label: "futuro-bajo", due_date: "2026-07-20", criticality: "low" }),
      item({ label: "vencido", due_date: "2026-07-01", criticality: "low" }),
      item({ label: "futuro-critico", due_date: "2026-07-15", criticality: "high" }),
    ];
    const order = overdueThenCritical(items, NOW).map((i) => i.label);
    expect(order).toEqual(["vencido", "futuro-critico", "futuro-bajo"]);
  });
  it("no rompe con fechas nulas (desempate sin NaN) y no muta el input", () => {
    const items = [
      item({ label: "sin-fecha-1", due_date: "", criticality: "low" }),
      item({ label: "sin-fecha-2", due_date: "", criticality: "low" }),
      item({ label: "con-fecha", due_date: "2026-07-10", criticality: "low" }),
    ];
    const snapshot = items.map((i) => i.label);
    const order = overdueThenCritical(items, NOW).map((i) => i.label);
    // La con-fecha (no vencida) ordena antes que las sin-fecha; sin crashear.
    expect(order[0]).toBe("con-fecha");
    expect(order).toHaveLength(3);
    expect(items.map((i) => i.label)).toEqual(snapshot); // input intacto
  });
});
