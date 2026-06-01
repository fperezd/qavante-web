/* Schema + transforms del form de VALOR de una vista de gestión. SIN React:
   testeable en vitest unit. Un mismo schema cubre crear y editar; el padre al
   crear viene por prop (no por el form). El backend re-valida (409/422/403). */

import { z } from "zod";
import type {
  CreateDimensionValueRequest,
  UpdateDimensionValueRequest,
} from "@/lib/api/management";
import type { DimensionValueTreeRow } from "./types";

export const valueFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  /** Código opcional ("" = sin código). */
  code: z.string(),
  description: z.string(),
});

export type ValueFormValues = z.infer<typeof valueFormSchema>;

export function emptyValueForm(): ValueFormValues {
  return { name: "", code: "", description: "" };
}

export function valueToForm(row: DimensionValueTreeRow): ValueFormValues {
  return { name: row.name, code: row.code, description: row.description };
}

/** El `parent_id` viene del contexto (crear sub-valor); "" / null = raíz. */
export function formToCreateValueRequest(
  v: ValueFormValues,
  parentId: string | null,
): CreateDimensionValueRequest {
  return {
    name: v.name.trim(),
    code: v.code.trim() || null,
    description: v.description.trim() || null,
    parent_id: parentId || null,
    /* No expuesto (ADR-0009: sin reorder manual). 0 = default del backend. */
    sort_order: 0,
  };
}

export function formToUpdateValueRequest(v: ValueFormValues): UpdateDimensionValueRequest {
  return {
    name: v.name.trim(),
    code: v.code.trim() || null,
    description: v.description.trim() || null,
  };
}
