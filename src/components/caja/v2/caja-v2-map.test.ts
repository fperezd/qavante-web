import { describe, it, expect } from "vitest";
import {
  serieDesdeCashFlow,
  serieAnclada,
  labelBucketCorto,
  cajaMinimoCLP,
  bucketPasado,
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

describe("serieAnclada (trayectoria anclada en el saldo de hoy)", () => {
  const now = new Date(2026, 6, 19); // 19-jul-2026
  const lbl = (p: string) => p;
  it("reconstruye hacia atrás: el último bucket pasado cierra en el saldo de hoy", () => {
    const bs = [bucket("2026-06-29", "-853476"), bucket("2026-07-06", "-15552")]; // dos semanas pasadas
    expect(serieAnclada(-3_935_682, bs, "week", now, lbl).map((p) => p.saldo)).toEqual([-3_920_130, -3_935_682]);
  });
  it("proyecta hacia adelante si todos son futuros", () => {
    const bs = [bucket("2026-07-20", "500"), bucket("2026-07-27", "-300")]; // dos semanas futuras
    expect(serieAnclada(1_000, bs, "week", now, lbl).map((p) => p.saldo)).toEqual([1_500, 1_200]);
  });
  it("sin buckets → []", () => {
    expect(serieAnclada(1_000, [], "week", now, lbl)).toEqual([]);
  });
});

describe("bucketPasado (proyectar desde hoy)", () => {
  const now = new Date(2026, 6, 18); // 18-jul-2026 (dentro de la semana 14–20 jul, mes jul)
  it("semana ya terminada → pasada", () => {
    expect(bucketPasado("2026-07-07", "week", now)).toBe(true);
  });
  it("semana en curso (contiene hoy) → NO pasada", () => {
    expect(bucketPasado("2026-07-14", "week", now)).toBe(false);
  });
  it("semana futura → NO pasada", () => {
    expect(bucketPasado("2026-07-21", "week", now)).toBe(false);
  });
  it("mes: junio ya terminó → pasado; julio (en curso) → no", () => {
    expect(bucketPasado("2026-06", "month", now)).toBe(true);
    expect(bucketPasado("2026-07", "month", now)).toBe(false);
  });
  it("día: ayer → pasado; hoy → no", () => {
    expect(bucketPasado("2026-07-17", "day", now)).toBe(true);
    expect(bucketPasado("2026-07-18", "day", now)).toBe(false);
  });
  it("período no parseable → false (no se descarta)", () => {
    expect(bucketPasado("basura", "week", now)).toBe(false);
  });
});

describe("bucketsDesdeHoy", () => {
  it("semanal: descarta pasadas, conserva la actual + futuras", () => {
    const now = new Date(2026, 6, 18);
    const bs = [bucket("2026-06-30", "1"), bucket("2026-07-07", "2"), bucket("2026-07-14", "3"), bucket("2026-07-21", "4")];
    expect(bucketsDesdeHoy(bs, "week", now).map((b) => b.period)).toEqual(["2026-07-14", "2026-07-21"]);
  });
  it("mensual: descarta los meses ya cerrados", () => {
    const now = new Date(2026, 6, 18);
    const bs = [bucket("2026-06", "1"), bucket("2026-07", "2"), bucket("2026-08", "3")];
    expect(bucketsDesdeHoy(bs, "month", now).map((b) => b.period)).toEqual(["2026-07", "2026-08"]);
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
