import { describe, expect, it } from "vitest";
import {
  classificationRuleIntentFingerprint,
  type CreateClassificationRuleRequest,
} from "./classification-rules";

function body(over: Partial<CreateClassificationRuleRequest> = {}): CreateClassificationRuleRequest {
  return {
    name: "Proveedor recurrente",
    source_type: "bank_movement",
    condition_field: "description",
    operator: "contains",
    condition_value: "PROVEEDOR SPA",
    canonical_category: "supplier_payment",
    management_account_id: "acc-1",
    priority: 10,
    confidence: 1,
    ...over,
  } as CreateClassificationRuleRequest;
}

describe("classificationRuleIntentFingerprint", () => {
  it("es estable aunque cambie el orden de inserción de las propiedades", () => {
    const a = body();
    const b = {
      confidence: a.confidence,
      priority: a.priority,
      management_account_id: a.management_account_id,
      canonical_category: a.canonical_category,
      condition_value: a.condition_value,
      operator: a.operator,
      condition_field: a.condition_field,
      source_type: a.source_type,
      name: a.name,
    } as CreateClassificationRuleRequest;

    expect(classificationRuleIntentFingerprint(a)).toBe(classificationRuleIntentFingerprint(b));
  });

  it("cambia cuando cambia una decisión financiera de la regla", () => {
    expect(classificationRuleIntentFingerprint(body())).not.toBe(
      classificationRuleIntentFingerprint(body({ canonical_category: "tax_payment" })),
    );
    expect(classificationRuleIntentFingerprint(body())).not.toBe(
      classificationRuleIntentFingerprint(body({ management_account_id: "acc-2" })),
    );
  });
});
