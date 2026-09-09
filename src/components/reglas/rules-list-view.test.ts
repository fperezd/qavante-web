import { describe, expect, it } from "vitest";
import type { ClassificationRule } from "@/lib/api/classification-rules";
import { filterRules } from "./rules-list-view";

function rule(id: string, origin: ClassificationRule["origin"], active = true): ClassificationRule {
  return {
    id,
    name: id,
    source_type: "bank_movement",
    origin,
    condition_field: "description",
    operator: "contains",
    condition_value: id,
    canonical_category: null,
    management_account_id: null,
    dimension_assignments: [],
    priority: 10,
    confidence: "0.90",
    active,
    created_by: null,
    created_at: "2026-09-01T12:00:00Z",
    updated_at: null,
  };
}

const RULES = [
  rule("aprendida", "learned_from_usage"),
  rule("manual", "created_by_user"),
  rule("base", "qavante_base"),
  rule("legada", "unknown"),
  rule("apagada", "learned_from_usage", false),
];

describe("filterRules", () => {
  it("Todas conserva las cinco reglas y su orden", () => {
    expect(filterRules(RULES, "all").map((item) => item.id)).toEqual([
      "aprendida",
      "manual",
      "base",
      "legada",
      "apagada",
    ]);
  });

  it("cada origen muestra sólo reglas activas de ese origen", () => {
    expect(filterRules(RULES, "learned_from_usage").map((item) => item.id)).toEqual(["aprendida"]);
    expect(filterRules(RULES, "created_by_user").map((item) => item.id)).toEqual(["manual"]);
    expect(filterRules(RULES, "qavante_base").map((item) => item.id)).toEqual(["base"]);
    expect(filterRules(RULES, "unknown").map((item) => item.id)).toEqual(["legada"]);
  });

  it("Desactivadas no depende del origen", () => {
    expect(filterRules(RULES, "inactive").map((item) => item.id)).toEqual(["apagada"]);
  });
});
