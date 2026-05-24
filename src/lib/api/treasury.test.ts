/* Sanity del contrato canonical-categories vía MSW + estabilidad de query
   keys. Si rompe tras tocar handlers.ts o treasury.ts, el mock dejó de
   respetar el shape §10.1 (CanonicalCategoryMeta) que la UI espera. */
import { describe, expect, it } from "vitest";
import {
  treasuryKeys,
  type CanonicalCategoryMeta,
  type BankMovementsListResponse,
  type BankMovement,
} from "./treasury";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("treasuryKeys", () => {
  it("canonicalCategories key es estable y namespaced", () => {
    expect(treasuryKeys.canonicalCategories()).toEqual(["treasury", "canonical-categories"]);
    expect(treasuryKeys.all).toEqual(["treasury"]);
  });

  it("bankMovements key namespaced y varía por params", () => {
    expect(treasuryKeys.bankMovements({ status: "unclassified" })).toEqual([
      "treasury",
      "bank-movements",
      { status: "unclassified" },
    ]);
    expect(treasuryKeys.bankMovements({ status: "unclassified" })).not.toEqual(
      treasuryKeys.bankMovements({ status: "classified" }),
    );
  });
});

describe("MSW — GET /api/treasury/canonical-categories", () => {
  it("devuelve 200 + items con el shape §10.1 completo", async () => {
    const r = await fetch(`${API}/api/treasury/canonical-categories`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { items: CanonicalCategoryMeta[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);

    for (const it of body.items) {
      expect(typeof it.code).toBe("string");
      expect(typeof it.label).toBe("string");
      expect(typeof it.description).toBe("string");
      expect(typeof it.expected_direction).toBe("string");
      expect(typeof it.cashflow_group).toBe("string");
      expect(typeof it.requires_review).toBe("boolean");
      expect(typeof it.allowed_for_bank_movement).toBe("boolean");
      expect(typeof it.sort_order).toBe("number");
    }
  });

  it("incluye 'unknown' → label humano 'Por clasificar' (§11)", async () => {
    const r = await fetch(`${API}/api/treasury/canonical-categories`);
    const body = (await r.json()) as { items: CanonicalCategoryMeta[] };
    const unknown = body.items.find((c) => c.code === "unknown");
    expect(unknown?.label).toBe("Por clasificar");
  });
});

describe("MSW — bank-movements (status + period filters)", () => {
  it("GET /api/bank-movements?status=unclassified → solo movimientos sin canonical_category", async () => {
    const r = await fetch(`${API}/api/bank-movements?status=unclassified`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as BankMovementsListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    for (const m of body.items) {
      expect(m.canonical_category).toBeNull();
    }
  });

  it("GET /api/bank-movements?status=classified → solo movimientos con canonical_category", async () => {
    const r = await fetch(`${API}/api/bank-movements?status=classified`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as BankMovementsListResponse;
    expect(body.items.length).toBeGreaterThan(0);
    for (const m of body.items) {
      expect(m.canonical_category).not.toBeNull();
      expect(typeof m.canonical_category).toBe("string");
    }
  });

  it("GET /api/bank-movements (sin status) → devuelve TODOS", async () => {
    const r = await fetch(`${API}/api/bank-movements`);
    const body = (await r.json()) as BankMovementsListResponse;
    const classifiedCount = body.items.filter((m) => m.canonical_category != null).length;
    const unclassifiedCount = body.items.filter((m) => m.canonical_category == null).length;
    expect(classifiedCount).toBeGreaterThan(0);
    expect(unclassifiedCount).toBeGreaterThan(0);
  });

  it("GET /api/bank-movements?period=2026-05 → filtra por mes", async () => {
    const r = await fetch(`${API}/api/bank-movements?period=2026-05`);
    const body = (await r.json()) as BankMovementsListResponse;
    for (const m of body.items) {
      expect(m.date.startsWith("2026-05")).toBe(true);
    }
  });

  it("GET /api/bank-movements?period=202604 → acepta formato compacto YYYYMM", async () => {
    /* El backend live acepta YYYY-MM, YYYYMM y "mes año". El handler MSW
       simula los dos numéricos; el FE normaliza a YYYY-MM antes (regla 16). */
    const r = await fetch(`${API}/api/bank-movements?period=202605`);
    const body = (await r.json()) as BankMovementsListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    for (const m of body.items) {
      expect(m.date.startsWith("2026-05")).toBe(true);
    }
  });

  it("PATCH /api/bank-movements/:id/classify → devuelve el movimiento clasificado", async () => {
    const r = await fetch(`${API}/api/bank-movements/mov-unclas-1/classify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        management_account_id: "acc-9",
        canonical_category: "supplier_payment",
      }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as BankMovement;
    expect(body.id).toBe("mov-unclas-1");
    expect(body.management_account_id).toBe("acc-9");
    expect(body.canonical_category).toBe("supplier_payment");
  });
});
