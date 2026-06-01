/* Schema + transforms del form de vista de gestión (dimensión). SIN React:
   testeable en vitest unit (patrón rule-form-schema / management-account).
   Un mismo schema cubre crear y editar; `code` es la clave natural → en
   editar se muestra read-only y NO se manda en el PATCH. El backend re-valida:
   409 code duplicado, 403 sin permiso (§20). */

import { z } from "zod";
import type { CreateDimensionRequest, UpdateDimensionRequest } from "@/lib/api/management";
import type { ManagementDimensionRow } from "./types";

const DATA_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "currency",
  "percentage",
  "reference",
] as const;

export const dimensionFormSchema = z.object({
  code: z.string().trim().min(1, "El código es requerido"),
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string(),
  dataType: z.enum(DATA_TYPES),
  isRequired: z.boolean(),
  isVisible: z.boolean(),
  allowsHierarchy: z.boolean(),
  allowsMultiple: z.boolean(),
});

export type DimensionFormValues = z.infer<typeof dimensionFormSchema>;

/** Valores iniciales al crear: defaults del contrato (text, visible,
 *  jerárquica, no obligatoria, single). */
export function emptyDimensionForm(): DimensionFormValues {
  return {
    code: "",
    name: "",
    description: "",
    dataType: "text",
    isRequired: false,
    isVisible: true,
    allowsHierarchy: true,
    allowsMultiple: false,
  };
}

/** Pre-pobla el form de edición desde la fila. */
export function dimensionToForm(row: ManagementDimensionRow): DimensionFormValues {
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    dataType: (DATA_TYPES as readonly string[]).includes(row.dataType)
      ? (row.dataType as DimensionFormValues["dataType"])
      : "text",
    isRequired: row.isRequired,
    isVisible: row.isVisible,
    allowsHierarchy: row.allowsHierarchy,
    allowsMultiple: row.allowsMultiple,
  };
}

export function formToCreateDimensionRequest(v: DimensionFormValues): CreateDimensionRequest {
  return {
    code: v.code.trim(),
    name: v.name.trim(),
    description: v.description.trim() || null,
    data_type: v.dataType,
    is_required: v.isRequired,
    is_visible: v.isVisible,
    allows_hierarchy: v.allowsHierarchy,
    allows_multiple_values: v.allowsMultiple,
    /* No expuesto (ADR-0009: sin reorder manual). 0 = default del backend. */
    sort_order: 0,
  };
}

/** PATCH parcial: `code` es inmutable (clave natural) → no se envía. */
export function formToUpdateDimensionRequest(v: DimensionFormValues): UpdateDimensionRequest {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    data_type: v.dataType,
    is_required: v.isRequired,
    is_visible: v.isVisible,
    allows_hierarchy: v.allowsHierarchy,
    allows_multiple_values: v.allowsMultiple,
  };
}
