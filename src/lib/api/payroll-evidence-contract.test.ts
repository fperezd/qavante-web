import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { api } from "./client";
import type { PayrollWorkerOutstanding } from "./payroll-evidence";
import { server } from "@/test/msw/node";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});

const API_BASE = "http://api.test";

/* Contrato de `GET /api/admin/treasury/payroll-worker-outstanding/{period}` (api#422 / #203).

   Hasta api#1093 esta respuesta salía al snapshot OpenAPI como `{"type":"object",
   "additionalProperties": true}`: no había tipos y este test no se podía escribir. Lo que fija
   acá es lo que la pantalla no puede perder en el transporte:

   - los montos llegan como STRING (`Decimal` exacto) y no se coercen a `number`;
   - un `null` en un monto se queda en `null`, nunca en `0`: el período no tiene con qué nombrar
     la cifra y `abstention_reasons` dice por qué;
   - `abstention_reasons` llega íntegro.

   El tipo viene del snapshot, así que si el backend cambiara la forma, `tsc` rompe acá y
   `npm run contract:check` caza el drift del snapshot. */

describe("GET /treasury/payroll-worker-outstanding/{period} · contrato api#422", () => {
  it("preserva los decimales como string y los null como ausencia, sin coerción", async () => {
    const body: PayrollWorkerOutstanding = {
      period: "202607",
      currency_code: "CLP",
      snapshot_id: null,
      obligation_observed_at: null,
      // El período sin sello: la obligación y el saldo confirmado son `null`, NO cero.
      obligation_amount: null,
      batch_allocated_amount: "0.0000",
      worker_allocated_amount: "0.0000",
      distribution_gap_amount: "0.0000",
      superseded_obligation_allocated_amount: "0.0000",
      confirmed_outstanding_amount: null,
      legacy_payable_outstanding_amount: "5582113.00",
      legacy_worker_outstanding_amount: "0.00",
      legacy_divergence_amount: "5582113.00",
      legacy_assumed_paid_amount: "16487377.00",
      legacy_outstanding_quality: "legacy_unverified",
      workers: [],
      abstention_reasons: ["obligation_snapshot_missing", "legacy_worker_paid_without_any_link"],
    };

    server.use(
      http.get(`${API_BASE}/api/admin/treasury/payroll-worker-outstanding/202607`, () =>
        HttpResponse.json(body),
      ),
    );

    const got = await api.get<PayrollWorkerOutstanding>(
      "/api/admin/treasury/payroll-worker-outstanding/202607",
    );

    expect(got.obligation_amount).toBeNull();
    expect(got.confirmed_outstanding_amount).toBeNull();
    // Y no se volvió cero por el camino: eso afirmaría una cifra que el período no tiene.
    expect(got.obligation_amount).not.toBe(0);
    expect(got.confirmed_outstanding_amount).not.toBe(0);
    expect(typeof got.legacy_assumed_paid_amount).toBe("string");
    expect(got.legacy_assumed_paid_amount).toBe("16487377.00");
    expect(got.abstention_reasons).toEqual([
      "obligation_snapshot_missing",
      "legacy_worker_paid_without_any_link",
    ]);
  });

  it("un trabajador confirmado conserva sus tres montos exactos", async () => {
    const body: PayrollWorkerOutstanding = {
      period: "202608",
      currency_code: "CLP",
      snapshot_id: "3f2f8a1e-1111-4222-8333-444455556666",
      obligation_observed_at: "2026-09-01T12:00:00Z",
      obligation_amount: "13953387.0000",
      batch_allocated_amount: "13113627.0000",
      worker_allocated_amount: "13113627.0000",
      distribution_gap_amount: "0.0000",
      superseded_obligation_allocated_amount: "0.0000",
      confirmed_outstanding_amount: "839760.0000",
      legacy_payable_outstanding_amount: "3000010.00",
      legacy_worker_outstanding_amount: "839760.00",
      legacy_divergence_amount: "2160250.00",
      legacy_assumed_paid_amount: "0.00",
      legacy_outstanding_quality: "legacy_unverified",
      workers: [
        {
          worker_rut: "10.341.986-7",
          worker_name: "Trabajador A",
          obligation_amount: "2000000.0000",
          confirmed_paid_amount: "2000000.0000",
          outstanding_amount: "0.0000",
          line_count: 1,
          currency_code: "CLP",
          state: "confirmed_paid",
          legacy_paid_amount: "2000000.00",
          legacy_status: "paid",
          legacy_bank_evidenced_amount: "2000000.00",
          legacy_manual_adjustment_amount: "0.00",
          legacy_evidence_quality: "legacy_bank_evidenced",
        },
      ],
      abstention_reasons: [],
    };

    server.use(
      http.get(`${API_BASE}/api/admin/treasury/payroll-worker-outstanding/202608`, () =>
        HttpResponse.json(body),
      ),
    );

    const got = await api.get<PayrollWorkerOutstanding>(
      "/api/admin/treasury/payroll-worker-outstanding/202608",
    );

    expect(got.workers).toHaveLength(1);
    const w = got.workers?.[0];
    expect(w).toBeDefined();
    if (!w) throw new Error("el contrato publico un trabajador y la respuesta no lo trajo");
    expect(w.state).toBe("confirmed_paid");
    expect(w.obligation_amount).toBe("2000000.0000");
    expect(w.confirmed_paid_amount).toBe("2000000.0000");
    expect(w.outstanding_amount).toBe("0.0000");
    expect(w.legacy_evidence_quality).toBe("legacy_bank_evidenced");
  });
});
