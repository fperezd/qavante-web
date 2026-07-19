import { describe, it, expect } from "vitest";
import {
  serieDesdeCashFlow,
  labelBucketCorto,
  cajaMinimoCLP,
  bucketSemanalPasado,
  bucketsDesdeHoy,
  flujoDeBuckets,
} from "./caja-v2-map";
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

describe("bucketSemanalPasado (proyectar desde hoy)", () => {
  const now = new Date(2026, 6, 18); // 18-jul-2026 (dentro de la semana 14–20 jul)
  it("una semana ya terminada es pasada", () => {
    expect(bucketSemanalPasado("2026-07-07", now)).toBe(true);
  });
  it("la semana en curso (contiene hoy) NO es pasada", () => {
    expect(bucketSemanalPasado("2026-07-14", now)).toBe(false);
  });
  it("una semana futura NO es pasada", () => {
    expect(bucketSemanalPasado("2026-07-21", now)).toBe(false);
  });
  it("período no parseable → false (no se descarta)", () => {
    expect(bucketSemanalPasado("2026-07", now)).toBe(false);
  });
});

describe("bucketsDesdeHoy", () => {
  it("descarta semanas pasadas, conserva la actual + futuras", () => {
    const now = new Date(2026, 6, 18);
    const bs = [bucket("2026-06-30", "1"), bucket("2026-07-07", "2"), bucket("2026-07-14", "3"), bucket("2026-07-21", "4")];
    expect(bucketsDesdeHoy(bs, now).map((b) => b.period)).toEqual(["2026-07-14", "2026-07-21"]);
  });
});

describe("flujoDeBuckets", () => {
  it("suma entra/sale/neto de los buckets", () => {
    const bs = [
      { period: "a", total_inflow: "1000", total_outflow: "-400", net: "600", row_count: 0 },
      { period: "b", total_inflow: "500", total_outflow: "-900", net: "-400", row_count: 0 },
    ] as CashFlowBucket[];
    expect(flujoDeBuckets(bs)).toEqual({ entra: 1500, sale: -1300, neto: 200 });
  });
  it("sin buckets → todo 0", () => {
    expect(flujoDeBuckets([])).toEqual({ entra: 0, sale: 0, neto: 0 });
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
