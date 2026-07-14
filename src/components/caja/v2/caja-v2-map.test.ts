import { describe, it, expect } from "vitest";
import { serieDesdeCashFlow, labelBucketCorto, cajaMinimoCLP } from "./caja-v2-map";
import type { CashFlowBucket } from "@/lib/api/treasury-reports";
import type { CashMinimumResponse } from "@/lib/api/cash-minimum";

const bucket = (period: string, net: string): CashFlowBucket =>
  ({ period, net, total_inflow: "0", total_outflow: "0", row_count: 0 }) as CashFlowBucket;

describe("labelBucketCorto", () => {
  it("YYYY-MM-DD → DD-mmm", () => {
    expect(labelBucketCorto("2026-07-14")).toBe("14-jul");
  });
  it("YYYY-MM → mmm", () => {
    expect(labelBucketCorto("2026-03")).toBe("mar");
  });
  it("formato desconocido → passthrough", () => {
    expect(labelBucketCorto("Semana 29")).toBe("Semana 29");
  });
});

describe("serieDesdeCashFlow", () => {
  it("deriva el saldo acumulado desde el saldo de hoy + netos", () => {
    const out = serieDesdeCashFlow(10_000, [bucket("2026-07-14", "-3000"), bucket("2026-07-21", "1000")]);
    expect(out).toEqual([
      { label: "hoy", saldo: 10_000 },
      { label: "14-jul", saldo: 7_000 },
      { label: "21-jul", saldo: 8_000 },
    ]);
  });
  it("sin buckets → solo el punto de hoy", () => {
    expect(serieDesdeCashFlow(5_000, [])).toEqual([{ label: "hoy", saldo: 5_000 }]);
  });
});

describe("cajaMinimoCLP", () => {
  it("toma el umbral CLP", () => {
    const cm = { thresholds: [{ currency_code: "CLP", amount: "4000000" }] } as CashMinimumResponse;
    expect(cajaMinimoCLP(cm)).toBe(4_000_000);
  });
  it("null si no hay umbral CLP", () => {
    const cm = { thresholds: [{ currency_code: "USD", amount: "5000" }] } as CashMinimumResponse;
    expect(cajaMinimoCLP(cm)).toBeNull();
    expect(cajaMinimoCLP(undefined)).toBeNull();
  });
});
