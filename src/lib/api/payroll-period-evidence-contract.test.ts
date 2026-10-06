import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { api } from "./client";
import { yyyymmToDashedPeriod, type PayrollPeriodEvidence } from "./payroll-evidence";
import { server } from "@/test/msw/node";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});

const API_BASE = "http://api.test";

/* Contrato de `GET /api/treasury/payroll-evidence/{period}` (api#422 / #203).

   Lo que fija, que es lo que la pantalla no puede perder en el transporte:

   - `observed_payment_amount` llega como STRING y sobrevive separado de todo lo confirmado: es
     la categoría "pago observado por verificar" del issue, y si se fundiera con lo confirmado
     el defecto volvería;
   - un `null` en un monto se queda en `null`, nunca en `0`;
   - el período va en `YYYY-MM`, no en `YYYYMM`: el contrato lo fija con el patrón
     `^\d{4}-(0[1-9]|1[0-2])$` y mandarle el otro formato da 422.

   El tipo sale del snapshot OpenAPI, así que `npm run contract:check` caza el drift. */

describe("GET /treasury/payroll-evidence/{period} · contrato api#422", () => {
  it("el período va en YYYY-MM, no en YYYYMM", () => {
    expect(yyyymmToDashedPeriod("202609")).toBe("2026-09");
    expect(yyyymmToDashedPeriod("2026-09")).toBe("");
    expect(yyyymmToDashedPeriod("")).toBe("");
  });

  it("preserva lo observado como string y los null como ausencia, sin coerción", async () => {
    const body: PayrollPeriodEvidence = {
      period: "202609",
      currency_code: "CLP",
      obligation_amount: "14113637.0000",
      obligation_observed_at: "2026-10-01T12:00:00Z",
      observed_payment_amount: "13113627.0000",
      legacy_outstanding_amount: "12114232.00",
      legacy_outstanding_quality: "legacy_unverified",
      // Sin confirmación no hay saldo que afirmar: `null` es abstención, no impago.
      confirmed_outstanding_amount: null,
      allocation_coverage: "unallocated",
      state: "observed_unconfirmed",
      abstention_reasons: ["payment_evidence_missing"],
    };

    server.use(
      http.get(`${API_BASE}/api/treasury/payroll-evidence/2026-09`, () => HttpResponse.json(body)),
    );

    const got = await api.get<PayrollPeriodEvidence>("/api/treasury/payroll-evidence/2026-09");

    expect(got.observed_payment_amount).toBe("13113627.0000");
    expect(typeof got.observed_payment_amount).toBe("string");
    expect(got.confirmed_outstanding_amount).toBeNull();
    expect(got.state).toBe("observed_unconfirmed");
    expect(got.allocation_coverage).toBe("unallocated");
    expect(got.abstention_reasons).toEqual(["payment_evidence_missing"]);
  });

  it("GEMELO: lo observado y lo confirmado viajan en campos distintos y no se funden", async () => {
    /* El gemelo del anterior: cuando el período SÍ está confirmado, lo observado sigue siendo
       su propio campo. Si el contrato los fundiera en uno, la pantalla no podría separarlos y
       el defecto de #203 volvería por el transporte. */
    const body: PayrollPeriodEvidence = {
      period: "202609",
      currency_code: "CLP",
      obligation_amount: "14113637.0000",
      obligation_observed_at: "2026-10-01T12:00:00Z",
      observed_payment_amount: "14113637.0000",
      legacy_outstanding_amount: "12114232.00",
      legacy_outstanding_quality: "legacy_unverified",
      confirmed_outstanding_amount: "0.0000",
      allocation_coverage: "full",
      state: "confirmed_paid",
      abstention_reasons: [],
    };

    server.use(
      http.get(`${API_BASE}/api/treasury/payroll-evidence/2026-09`, () => HttpResponse.json(body)),
    );

    const got = await api.get<PayrollPeriodEvidence>("/api/treasury/payroll-evidence/2026-09");

    expect(got.observed_payment_amount).toBe("14113637.0000");
    expect(got.confirmed_outstanding_amount).toBe("0.0000");
    expect(got.state).toBe("confirmed_paid");
  });
});
