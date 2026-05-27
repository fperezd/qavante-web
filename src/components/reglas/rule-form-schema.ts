/* Schema + transforms del editor de reglas de clasificación (Addendum §17).
   Vive aparte del dialog para mantenerse testeable sin renderizar UI — el
   proyecto vitest `unit` corre Node-puro (no jsdom).

   Decisiones de scope (consistente con §17 y memoria del proyecto):
   - El editor cubre los campos *clasificatorios* (matching + categoría +
     prioridad + confianza). NO cubre `management_account_id` ni
     `dimension_assignments` — eso vive en el drawer §17 al clasificar
     manualmente, no en el editor masivo.
   - `source_type` está hardcoded a "bank_movement" (los otros source_types
     se introducirán cuando entren documentos/manual_entry; §17 v1 cubre
     solo movimientos bancarios).
   - El PATCH del backend no acepta `source_type` ni `management_account_id`
     (ver `UpdateClassificationRuleRequest`); el form solo manda los campos
     editables del PATCH.

   El backend re-valida (es la verdad). 422 si dominio inválido. */
import { z } from "zod";
import type {
  ClassificationRule,
  CreateClassificationRuleRequest,
  SuggestRuleResponse,
  UpdateClassificationRuleRequest,
} from "@/lib/api/classification-rules";

/* Enum cerrado §18.2 — el backend valida; el FE limita el select. */
export const CONDITION_FIELDS = [
  "description",
  "counterparty_name",
  "reference",
  "amount",
  "currency_code",
  "bank_account_id",
] as const;

export const OPERATORS = [
  "equals",
  "contains",
  "starts_with",
  "ends_with",
  "regex",
  "greater_than",
  "less_than",
] as const;

/* Confianza expuesta como escalones (UX-friendly). El contrato es float
   0-1; valores fuera del set no son inválidos pero esta UI no los ofrece. */
export const CONFIDENCE_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0] as const;

export const ruleFormSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la regla"),
  condition_field: z.enum(CONDITION_FIELDS, {
    message: "Elige el campo a evaluar",
  }),
  operator: z.enum(OPERATORS, {
    message: "Elige el operador",
  }),
  condition_value: z.string().trim().min(1, "Ingresa un valor para comparar"),
  /* `""` = sin categoría canónica (regla sólo asigna prioridad/orden, no
     categoría). El backend lo acepta como `null`. */
  canonical_category: z.string(),
  priority: z
    .number({ message: "La prioridad es un número entero entre 1 y 1000" })
    .int("La prioridad es un número entero")
    .min(1, "La prioridad mínima es 1")
    .max(1000, "La prioridad máxima es 1000"),
  confidence: z.number({ message: "Elige un nivel de confianza" }).min(0).max(1),
});

export type RuleFormValues = z.infer<typeof ruleFormSchema>;

/* Default Chile / v1: matching por glosa, operador contiene, prioridad 100,
   confianza 80%. Replica del default backend (§17.6 / §18.2). */
export const RULE_FORM_DEFAULTS: RuleFormValues = {
  name: "",
  condition_field: "description",
  operator: "contains",
  condition_value: "",
  canonical_category: "",
  priority: 100,
  confidence: 0.8,
};

/** Snapshot de regla → valores iniciales del form. `null`/`undefined` = crear
 *  (defaults v1). Caso "editar": parseamos `confidence` (response = string,
 *  request = number — ver types.ts) y mapeamos null → "" en canonical_category
 *  para que el select tenga una opción "sin categoría". */
export function ruleToForm(rule: ClassificationRule | null | undefined): RuleFormValues {
  if (!rule) return { ...RULE_FORM_DEFAULTS };
  return {
    name: rule.name,
    condition_field: assertConditionField(rule.condition_field),
    operator: assertOperator(rule.operator),
    condition_value: rule.condition_value,
    canonical_category: rule.canonical_category ?? "",
    priority: rule.priority,
    confidence: parseFloat(rule.confidence) || 0.8,
  };
}

/** Form → body de POST. `source_type` hardcoded a `"bank_movement"` (v1).
 *  `canonical_category` vacío se manda como `null` (sin categoría). */
export function formToCreateRequest(values: RuleFormValues): CreateClassificationRuleRequest {
  return {
    name: values.name.trim(),
    source_type: "bank_movement",
    condition_field: values.condition_field,
    operator: values.operator,
    condition_value: values.condition_value.trim(),
    canonical_category: values.canonical_category
      ? (values.canonical_category as CreateClassificationRuleRequest["canonical_category"])
      : null,
    priority: values.priority,
    confidence: values.confidence,
  };
}

/** Form → body de PATCH. El backend no acepta `source_type` ni
 *  `management_account_id` en el PATCH; solo los campos editables del
 *  matching + categoría + prioridad + confianza. */
export function formToUpdateRequest(values: RuleFormValues): UpdateClassificationRuleRequest {
  return {
    name: values.name.trim(),
    condition_field: values.condition_field,
    operator: values.operator,
    condition_value: values.condition_value.trim(),
    canonical_category: values.canonical_category
      ? (values.canonical_category as UpdateClassificationRuleRequest["canonical_category"])
      : null,
    priority: values.priority,
    confidence: values.confidence,
  };
}

/** Sugerencia §18.7 (POST /api/bank-movements/{id}/suggest-rule, read-only)
 *  → valores parciales para pre-poblar el form. Solo mapeamos los campos
 *  declarados en el shape estable (§18.7): name, condition_field, operator,
 *  condition_value. El resto (priority/confidence/category) queda al user.
 *
 *  Defensivo: si el backend devuelve un campo/operador fuera del enum del
 *  FE (forward-compat antes del siguiente generate:api), lo dropeamos. El
 *  user verá el form con el default seguro y puede ajustar manualmente. */
export function suggestionToFormValues(s: SuggestRuleResponse): Partial<RuleFormValues> {
  const out: Partial<RuleFormValues> = {};
  if (typeof s.name === "string" && s.name.trim() !== "") out.name = s.name;
  if (
    typeof s.condition_field === "string" &&
    (CONDITION_FIELDS as readonly string[]).includes(s.condition_field)
  ) {
    out.condition_field = s.condition_field as (typeof CONDITION_FIELDS)[number];
  }
  if (typeof s.operator === "string" && (OPERATORS as readonly string[]).includes(s.operator)) {
    out.operator = s.operator as (typeof OPERATORS)[number];
  }
  if (typeof s.condition_value === "string" && s.condition_value.trim() !== "") {
    out.condition_value = s.condition_value;
  }
  return out;
}

/* Helpers de narrowing: si el backend incorpora nuevos valores al enum
   antes del próximo `npm run generate:api`, caemos al default seguro
   (`description` / `contains`) en lugar de romper el form. El backend
   re-valida y devolverá 422 si el dominio cambió. */
function assertConditionField(v: string): (typeof CONDITION_FIELDS)[number] {
  return (CONDITION_FIELDS as readonly string[]).includes(v)
    ? (v as (typeof CONDITION_FIELDS)[number])
    : "description";
}

function assertOperator(v: string): (typeof OPERATORS)[number] {
  return (OPERATORS as readonly string[]).includes(v)
    ? (v as (typeof OPERATORS)[number])
    : "contains";
}
