/* Sanity del contrato classification-rules vía MSW + estabilidad de query
   keys (Addendum §17.5/§17.6/§18.7). Si rompe tras tocar handlers.ts o
   classification-rules.ts, el mock dejó de respetar el shape ClassificationRule
   que la UI espera. */
import { describe, expect, it } from "vitest";
import {
  classificationRulesKeys,
  type ClassificationRule,
  type ClassificationRulesResponse,
  type SuggestRuleResponse,
} from "./classification-rules";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("classificationRulesKeys", () => {
  it("namespacing estable y discriminado por params", () => {
    expect(classificationRulesKeys.all).toEqual(["classification-rules"]);
    expect(classificationRulesKeys.list()).toEqual(["classification-rules", "list"]);
    expect(classificationRulesKeys.suggestForMovement("mov-1")).toEqual([
      "classification-rules",
      "suggest",
      "mov-1",
    ]);
    /* keys de movimientos distintos no colisionan */
    expect(classificationRulesKeys.suggestForMovement("mov-1")).not.toEqual(
      classificationRulesKeys.suggestForMovement("mov-2"),
    );
  });
});

describe("MSW — GET /api/treasury/classification-rules", () => {
  it("devuelve items con shape ClassificationRule completo y orden ASC por priority", async () => {
    const r = await fetch(`${API}/api/treasury/classification-rules`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as ClassificationRulesResponse;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);

    for (const rule of body.items) {
      expect(typeof rule.id).toBe("string");
      expect(typeof rule.name).toBe("string");
      expect(typeof rule.source_type).toBe("string");
      expect(typeof rule.condition_field).toBe("string");
      expect(typeof rule.operator).toBe("string");
      expect(typeof rule.condition_value).toBe("string");
      expect(typeof rule.priority).toBe("number");
      expect(typeof rule.active).toBe("boolean");
    }

    /* Orden ASC por priority — orden de evaluación. */
    const priorities = body.items.map((r) => r.priority);
    const sorted = [...priorities].sort((a, b) => a - b);
    expect(priorities).toEqual(sorted);
  });

  it("incluye reglas activas y desactivadas (§17.5: NO se borran)", async () => {
    const r = await fetch(`${API}/api/treasury/classification-rules`);
    const body = (await r.json()) as ClassificationRulesResponse;
    const actives = body.items.filter((r) => r.active);
    const inactives = body.items.filter((r) => !r.active);
    expect(actives.length).toBeGreaterThan(0);
    expect(inactives.length).toBeGreaterThan(0);
  });
});

describe("MSW — POST /api/treasury/classification-rules", () => {
  it("crea regla con campos requeridos → 201 + shape ClassificationRule", async () => {
    const r = await fetch(`${API}/api/treasury/classification-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Nueva regla test",
        source_type: "bank_movement",
        condition_field: "description",
        operator: "contains",
        condition_value: "TEST",
        priority: 200,
        confidence: 0.85,
      }),
    });
    expect(r.status).toBe(201);
    const rule = (await r.json()) as ClassificationRule;
    expect(rule.name).toBe("Nueva regla test");
    expect(rule.active).toBe(true);
    expect(rule.priority).toBe(200);
    /* confidence en el contrato es string aunque viaje como number en
       el request (§17.6 — el backend lo emite serializado). */
    expect(typeof rule.confidence).toBe("string");
  });

  it("falta name/condition → 422", async () => {
    const r = await fetch(`${API}/api/treasury/classification-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Solo nombre" }),
    });
    expect(r.status).toBe(422);
  });
});

describe("MSW — toggle-active (§17.5: desactivable, no borrable)", () => {
  it("invierte el flag active y actualiza updated_at", async () => {
    /* Activa → inactiva. */
    const r1 = await fetch(`${API}/api/treasury/classification-rules/rule-1/toggle-active`, {
      method: "POST",
    });
    expect(r1.status).toBe(200);
    const after1 = (await r1.json()) as ClassificationRule;
    expect(after1.active).toBe(false);
    expect(after1.updated_at).not.toBeNull();

    /* Inactiva → activa. */
    const r2 = await fetch(`${API}/api/treasury/classification-rules/rule-1/toggle-active`, {
      method: "POST",
    });
    const after2 = (await r2.json()) as ClassificationRule;
    expect(after2.active).toBe(true);
  });
});

describe("MSW — suggest-rule (§18.7: read-only)", () => {
  it("devuelve sugerencia con shape SuggestRuleResponse y NO persiste", async () => {
    /* Snapshot count antes. */
    const before = await fetch(`${API}/api/treasury/classification-rules`).then(
      (r) => r.json() as Promise<ClassificationRulesResponse>,
    );
    const countBefore = before.items.length;

    const r = await fetch(`${API}/api/bank-movements/mov-9/suggest-rule`, { method: "POST" });
    expect(r.status).toBe(200);
    const suggestion = (await r.json()) as SuggestRuleResponse;
    expect(typeof suggestion.name).toBe("string");
    expect(suggestion.condition_field).toBe("description");

    /* No persistencia: el count no cambió. */
    const after = await fetch(`${API}/api/treasury/classification-rules`).then(
      (r) => r.json() as Promise<ClassificationRulesResponse>,
    );
    expect(after.items.length).toBe(countBefore);
  });
});
