/* Schema + transforms del form de cuenta de gestión. SIN React: testeable en
   vitest unit (patrón rule-form-schema). El backend re-valida (es la verdad):
   409 code duplicado, 422 dominio inválido, 403 sin permiso (§20). */

import { z } from "zod";
import type {
  CreateManagementAccountRequest,
  ManagementAccountNode,
  UpdateManagementAccountRequest,
} from "@/lib/api/management";
import type { ManagementAccountTreeRow } from "./types";

export const accountFormSchema = z.object({
  code: z.string().trim().min(1, "El código es requerido"),
  name: z.string().trim().min(1, "El nombre es requerido"),
  type: z.string().min(1, "Elige un tipo"),
  destination: z.string().min(1, "Elige un destino"),
  /** "" = cuenta raíz (sin padre). */
  parentId: z.string(),
  description: z.string(),
  affectsPulso: z.boolean(),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

/** Valores iniciales del form de creación. `parentId` se pre-setea al crear
 *  una sub-cuenta; `type`/`destination` se eligen de los dominios existentes. */
export function emptyAccountForm(parentId = "", type = "", destination = ""): AccountFormValues {
  return {
    code: "",
    name: "",
    type,
    destination,
    parentId,
    description: "",
    affectsPulso: true,
  };
}

export function formToCreateRequest(v: AccountFormValues): CreateManagementAccountRequest {
  return {
    code: v.code.trim(),
    name: v.name.trim(),
    type: v.type,
    destination: v.destination,
    parent_id: v.parentId || null,
    description: v.description.trim() || null,
    affects_pulso: v.affectsPulso,
    is_visible: true,
    /* No expuesto al usuario (ADR-0009: sin reorder manual). El backend
       ordena; 0 = su default. */
    sort_order: 0,
  };
}

/* ── Edición (PATCH) ──────────────────────────────────────────────────────
   Solo los campos que el editor expone: nombre, glosa y afecta-Pulso. El
   contrato PATCH también acepta display_name/is_visible/sort_order, pero
   is_visible tiene su toggle en el árbol y sort_order no es editable
   (ADR-0009). code/type/destination/parent NO son mutables vía PATCH. */

export const accountEditFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string(),
  affectsPulso: z.boolean(),
});

export type AccountEditFormValues = z.infer<typeof accountEditFormSchema>;

/** Valores iniciales del form de edición desde la fila del árbol. */
export function accountToEditForm(row: ManagementAccountTreeRow): AccountEditFormValues {
  return {
    name: row.name,
    description: row.description,
    affectsPulso: row.affectsPulso,
  };
}

export function formToUpdateRequest(v: AccountEditFormValues): UpdateManagementAccountRequest {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    affects_pulso: v.affectsPulso,
  };
}

/** Dominios (`type`/`destination`) presentes en el árbol, para poblar los
 *  selects de creación con valores válidos. Distintos + ordenados. */
export function collectAccountDomains(nodes: ManagementAccountNode[]): {
  types: string[];
  destinations: string[];
} {
  const types = new Set<string>();
  const destinations = new Set<string>();
  const walk = (list: ManagementAccountNode[]) => {
    for (const n of list) {
      if (n.type) types.add(n.type);
      if (n.destination) destinations.add(n.destination);
      if (n.children && n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return {
    types: [...types].sort(),
    destinations: [...destinations].sort(),
  };
}

/** Humaniza un enum snake_case ("operating_expense" → "Operating expense").
 *  Display-only; el value enviado al backend es el código crudo. */
export function humanizeDomain(value: string): string {
  if (!value) return value;
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
