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

describe("MSW — bank-movements", () => {
  it("GET /api/bank-movements → { items, total }", async () => {
    const r = await fetch(`${API}/api/bank-movements?status=unclassified`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as BankMovementsListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    const m = body.items[0];
    if (!m) throw new Error("fixture debe traer al menos un movimiento");
    expect(typeof m.id).toBe("string");
    expect(typeof m.description).toBe("string");
    expect(typeof m.amount).toBe("string");
  });

  it("PATCH /api/bank-movements/:id/classify → devuelve el movimiento clasificado", async () => {
    const r = await fetch(`${API}/api/bank-movements/mov-1/classify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        management_account_id: "acc-9",
        canonical_category: "supplier_payment",
      }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as BankMovement;
    expect(body.id).toBe("mov-1");
    expect(body.management_account_id).toBe("acc-9");
    expect(body.canonical_category).toBe("supplier_payment");
  });
});
