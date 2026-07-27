import type { ManagementAccountNode } from "@/lib/api/management";

/* Opciones de cuenta para clasificar remuneraciones (ADR-0079). El dueño asigna
   cada empleado a una cuenta del plan: `direct_cost.*` = costo de servicio (sube
   el margen, arriba de la línea) · `operating_expense.*` = gasto (bajo la línea).
   Solo esos dos dominios tienen sentido para el costo de una persona; el resto
   del plan (ingresos, etc.) se omite del dropdown. Puro y testeable. */

export type CuentaGrupo = "costo" | "gasto";

export interface CuentaOption {
  code: string;
  label: string;
  grupo: CuentaGrupo;
}

const GRUPO_POR_TIPO: Record<string, CuentaGrupo> = {
  direct_cost: "costo",
  operating_expense: "gasto",
};

export const GRUPO_LABEL: Record<CuentaGrupo, string> = {
  costo: "Costo de servicio (sube el margen)",
  gasto: "Gasto (bajo el margen)",
};

/** Aplana el árbol de cuentas a las opciones asignables a un empleado
    (direct_cost / operating_expense, activas y visibles). */
export function payrollCuentaOptions(items: ManagementAccountNode[]): CuentaOption[] {
  const out: CuentaOption[] = [];
  const walk = (list: ManagementAccountNode[]) => {
    for (const n of list) {
      const grupo = GRUPO_POR_TIPO[n.type];
      if (grupo && n.active && n.is_visible) {
        out.push({ code: n.code, label: n.display_name || n.name, grupo });
      }
      if (n.children && n.children.length > 0) walk(n.children);
    }
  };
  walk(items);
  return out;
}

/** Agrupa las opciones por grupo (para los optgroup del select), preservando el orden. */
export function agruparCuentaOptions(
  options: CuentaOption[],
): Array<{ grupo: CuentaGrupo; label: string; options: CuentaOption[] }> {
  const grupos: CuentaGrupo[] = ["costo", "gasto"];
  return grupos
    .map((grupo) => ({
      grupo,
      label: GRUPO_LABEL[grupo],
      options: options.filter((o) => o.grupo === grupo),
    }))
    .filter((g) => g.options.length > 0);
}
