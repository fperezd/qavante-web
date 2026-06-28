/* Sanity del contrato de obligaciones vía MSW + estabilidad de query keys. */
import { describe, expect, it } from "vitest";
import {
  obligationKeys,
  type ObligationsListResponse,
  type ObligationDetailResponse,
  type ObligationReconcileResponse,
} from "./obligations";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("obligationKeys", () => {
  it("keys namespaced y estables", () => {
    expect(obligationKeys.all).toEqual(["obligations"]);
    expect(obligationKeys.list()).toEqual(["obligations", "list"]);
    expect(obligationKeys.detail("obl-1")).toEqual(["obligations", "detail", "obl-1"]);
    expect(obligationKeys.detail("a")).not.toEqual(obligationKeys.detail("b"));
  });
});

describe("MSW — obligaciones", () => {
  it("GET /api/treasury/obligations → items con shape de lista", async () => {
    const r = await fetch(`${API}/api/treasury/obligations`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as ObligationsListResponse;
    const items = body.items ?? [];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    const o = items[0]!;
    expect(typeof o.id).toBe("string");
    expect(typeof o.principal_total).toBe("string");
    expect(typeof o.outstanding_total).toBe("string");
    expect(typeof o.pending_count).toBe("number");
    expect(typeof o.installments_total).toBe("number");
    expect(typeof o.status).toBe("string");
  });

  it("GET /api/treasury/obligations/:id → cabecera + calendario", async () => {
    const r = await fetch(`${API}/api/treasury/obligations/obl-1`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as ObligationDetailResponse;
    expect(body.obligation.id).toBeDefined();
    expect(Array.isArray(body.installments)).toBe(true);
    const cuota = body.installments![0]!;
    expect(typeof cuota.number).toBe("number");
    expect(typeof cuota.due_date).toBe("string");
    expect(typeof cuota.total_amount).toBe("string");
    expect(typeof cuota.status).toBe("string");
  });

  it("POST /api/treasury/obligations/reconcile → { reconciled }", async () => {
    const r = await fetch(`${API}/api/treasury/obligations/reconcile`, { method: "POST" });
    expect(r.status).toBe(200);
    const body = (await r.json()) as ObligationReconcileResponse;
    expect(typeof body.reconciled).toBe("number");
  });
});
