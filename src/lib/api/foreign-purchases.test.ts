/* Sanity del contrato de compras al extranjero vía MSW + query keys. */
import { describe, expect, it } from "vitest";
import { foreignPurchaseKeys, type ForeignPurchasesListResponse } from "./foreign-purchases";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("foreignPurchaseKeys", () => {
  it("keys namespaced y estables", () => {
    expect(foreignPurchaseKeys.all).toEqual(["foreign-purchases"]);
    expect(foreignPurchaseKeys.list()).toEqual(["foreign-purchases", "list"]);
  });
});

describe("MSW — compras al extranjero", () => {
  it("GET /api/treasury/foreign-purchases → items con shape", async () => {
    const r = await fetch(`${API}/api/treasury/foreign-purchases`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as ForeignPurchasesListResponse;
    const items = body.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    const p = items[0]!;
    expect(typeof p.id).toBe("string");
    expect(typeof p.merchant).toBe("string");
    expect(typeof p.amount_usd).toBe("string");
    expect(typeof p.needs_review).toBe("boolean");
  });

  it("POST classify sin concepto/categoría → 422", async () => {
    const r = await fetch(`${API}/api/treasury/foreign-purchases/fp-1/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept: "" }),
    });
    expect(r.status).toBe(422);
  });
});
