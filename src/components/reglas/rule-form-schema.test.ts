/* Tests del schema + transforms del editor de reglas de clasificación
   (Addendum §17). Validamos que el FE no le manda al backend formas
   inválidas (campo/operador fuera del enum, prioridad fuera de rango,
   nombre vacío) y que el roundtrip rule → form → request preserva los
   campos editables y omite los read-only. */
import { describe, expect, it } from "vitest";
import {
  CONDITION_FIELDS,
  CONFIDENCE_STEPS,
  OPERATORS,
  RULE_FORM_DEFAULTS,
  formToCreateRequest,
  formToUpdateRequest,
  ruleFormSchema,
  ruleToForm,
  type RuleFormValues,
} from "./rule-form-schema";
import type { ClassificationRule } from "@/lib/api/classification-rules";

function validForm(overrides: Partial<RuleFormValues> = {}): RuleFormValues {
  return {
    name: "Sueldo Fernando",
    condition_field: "description",
    operator: "contains",
    condition_value: "SUELDO",
    canonical_category: "",
    priority: 50,
    confidence: 0.9,
    ...overrides,
  };
}

describe("ruleFormSchema — dominio + rangos", () => {
  it("acepta un form mínimo válido (default v1)", () => {
    const r = ruleFormSchema.safeParse(validForm());
    expect(r.success).toBe(true);
  });

  it("acepta defaults (priority 100, confidence 0.8)", () => {
    const r = ruleFormSchema.safeParse({
      ...RULE_FORM_DEFAULTS,
      name: "X",
      condition_value: "Y",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza name vacío o solo espacios", () => {
    expect(ruleFormSchema.safeParse(validForm({ name: "" })).success).toBe(false);
    expect(ruleFormSchema.safeParse(validForm({ name: "   " })).success).toBe(false);
  });

  it("rechaza condition_value vacío", () => {
    const r = ruleFormSchema.safeParse(validForm({ condition_value: "" }));
    expect(r.success).toBe(false);
  });

  it("rechaza condition_field fuera del enum §18.2", () => {
    const r = ruleFormSchema.safeParse({
      ...validForm(),
      condition_field: "no_existe" as unknown as (typeof CONDITION_FIELDS)[number],
    });
    expect(r.success).toBe(false);
  });

  it("rechaza operator fuera del enum §18.2", () => {
    const r = ruleFormSchema.safeParse({
      ...validForm(),
      operator: "modulo" as unknown as (typeof OPERATORS)[number],
    });
    expect(r.success).toBe(false);
  });

  it("rechaza priority fuera de [1, 1000]", () => {
    expect(ruleFormSchema.safeParse(validForm({ priority: 0 })).success).toBe(false);
    expect(ruleFormSchema.safeParse(validForm({ priority: 1001 })).success).toBe(false);
    expect(ruleFormSchema.safeParse(validForm({ priority: 1 })).success).toBe(true);
    expect(ruleFormSchema.safeParse(validForm({ priority: 1000 })).success).toBe(true);
  });

  it("rechaza priority no entero", () => {
    const r = ruleFormSchema.safeParse(validForm({ priority: 50.5 }));
    expect(r.success).toBe(false);
  });

  it("acepta todos los CONFIDENCE_STEPS del UI", () => {
    for (const c of CONFIDENCE_STEPS) {
      const r = ruleFormSchema.safeParse(validForm({ confidence: c }));
      expect(r.success).toBe(true);
    }
  });
});

describe("ruleToForm — snapshot → defaults", () => {
  it("null → defaults v1 (description/contains/priority 100/confidence 0.8)", () => {
    expect(ruleToForm(null)).toEqual(RULE_FORM_DEFAULTS);
    expect(ruleToForm(undefined)).toEqual(RULE_FORM_DEFAULTS);
  });

  it("regla existente → mapea confidence string → number y null → ''", () => {
    const rule: ClassificationRule = {
      id: "r1",
      name: "Movistar",
      source_type: "bank_movement",
      condition_field: "counterparty_name",
      operator: "contains",
      condition_value: "MOVISTAR",
      canonical_category: null,
      management_account_id: null,
      dimension_assignments: [],
      priority: 50,
      confidence: "0.95",
      active: true,
      created_by: "u_owner_01",
      created_at: "2026-05-01T00:00:00Z",
      updated_at: null,
    };
    const form = ruleToForm(rule);
    expect(form.name).toBe("Movistar");
    expect(form.condition_field).toBe("counterparty_name");
    expect(form.confidence).toBe(0.95);
    expect(form.canonical_category).toBe("");
    expect(form.priority).toBe(50);
  });

  it("regla con condition_field/operator desconocidos cae a default seguro", () => {
    /* Forward-compat: si el backend agrega valores nuevos antes del
       siguiente generate:api, no rompemos el form. */
    const rule: ClassificationRule = {
      id: "r1",
      name: "X",
      source_type: "bank_movement",
      condition_field: "future_field_added_by_backend",
      operator: "future_operator",
      condition_value: "Y",
      canonical_category: null,
      management_account_id: null,
      dimension_assignments: [],
      priority: 100,
      confidence: "0.8",
      active: true,
      created_by: "u_owner_01",
      created_at: "2026-05-01T00:00:00Z",
      updated_at: null,
    };
    const form = ruleToForm(rule);
    expect(form.condition_field).toBe("description");
    expect(form.operator).toBe("contains");
  });
});

describe("formToCreateRequest — POST body", () => {
  it("hardcodea source_type='bank_movement' (v1) y trimea strings", () => {
    const body = formToCreateRequest(
      validForm({ name: "  Sueldo  ", condition_value: "  SUELDO  " }),
    );
    expect(body.source_type).toBe("bank_movement");
    expect(body.name).toBe("Sueldo");
    expect(body.condition_value).toBe("SUELDO");
  });

  it("'' canonical_category → null en el body", () => {
    const body = formToCreateRequest(validForm());
    expect(body.canonical_category).toBeNull();
  });

  it("canonical_category con código manda el código tal cual", () => {
    const body = formToCreateRequest(validForm({ canonical_category: "supplier_payment" }));
    expect(body.canonical_category).toBe("supplier_payment");
  });

  it("confidence se manda como number (no string)", () => {
    const body = formToCreateRequest(validForm({ confidence: 0.95 }));
    expect(typeof body.confidence).toBe("number");
    expect(body.confidence).toBe(0.95);
  });
});

describe("formToUpdateRequest — PATCH body (sin source_type ni management_account_id)", () => {
  it("NO incluye source_type ni management_account_id (no editables vía PATCH)", () => {
    const body = formToUpdateRequest(validForm()) as Record<string, unknown>;
    expect(body.source_type).toBeUndefined();
    expect(body.management_account_id).toBeUndefined();
  });

  it("incluye todos los campos editables", () => {
    const body = formToUpdateRequest(validForm({ priority: 25, confidence: 1.0 }));
    expect(body.name).toBe("Sueldo Fernando");
    expect(body.condition_field).toBe("description");
    expect(body.operator).toBe("contains");
    expect(body.condition_value).toBe("SUELDO");
    expect(body.priority).toBe(25);
    expect(body.confidence).toBe(1.0);
  });

  it("trimea strings (consistente con create)", () => {
    const body = formToUpdateRequest(validForm({ name: "  X  ", condition_value: "  Y  " }));
    expect(body.name).toBe("X");
    expect(body.condition_value).toBe("Y");
  });
});
