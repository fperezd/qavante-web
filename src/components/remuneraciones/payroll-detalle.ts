/* Detalle de planilla POR EMPLEADO (para conciliación bancaria). PURO/testeable.
 *
 * Caso de uso (Fernando, owner): el líquido de cada trabajador se cruza contra
 * los débitos de sueldos del banco. Necesitamos, por empleado, `nombre + rut +
 * liquido` del período.
 *
 * FE-first: el contrato lo escalé a CC-API (extender `/api/buk/payroll` con un
 * array `detalle`, gated owner/admin). Hoy `PayrollResponse` NO tipa `detalle`,
 * pero su index signature lo permite → lo leemos de forma defensiva. Cuando
 * CC-API lo shipee, se corre `generate:api` y queda tipado. Tolerante a nombres
 * alternativos de campo (no adivinamos: aceptamos los más probables). */

import type { PayrollResponse } from "@/lib/api/buk";

export interface EmployeePayroll {
  /** Id del empleado (string para keys). "" si falta. */
  id: string;
  nombre: string;
  rut: string | null;
  /** Líquido del período (lo que se paga → cruza contra el banco). null si falta. */
  liquido: number | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function firstNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = num(v);
    if (n !== null) return n;
  }
  return null;
}

/** Lee el detalle por empleado del payroll de forma defensiva. Devuelve [] si el
 *  backend todavía no expone `detalle` (contrato FE-first pendiente). */
export function normalizePayrollDetalle(data: PayrollResponse | undefined): EmployeePayroll[] {
  const detalle = (data as Record<string, unknown> | undefined)?.detalle;
  if (!Array.isArray(detalle)) return [];
  return detalle.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const idRaw = r.employee_id ?? r.id;
    return {
      id: idRaw != null ? String(idRaw) : "",
      nombre: str(r.nombre) ?? str(r.full_name) ?? str(r.name) ?? "Sin nombre",
      rut: str(r.rut),
      liquido: firstNum(r.liquido, r.monto_liquido, r.total_liquido, r.liquid),
    };
  });
}

/** Suma los líquidos del detalle (para cuadrar contra el total agregado). */
export function sumLiquido(rows: EmployeePayroll[]): number {
  return rows.reduce((acc, r) => acc + (r.liquido ?? 0), 0);
}

/** ¿La suma del detalle cuadra con el total agregado del período? (Tolerancia
 *  de $1 por redondeos.) Sirve como indicador de completitud para conciliar. */
export function detalleCuadra(rows: EmployeePayroll[], totalLiquido: number | undefined): boolean {
  if (typeof totalLiquido !== "number" || rows.length === 0) return false;
  return Math.abs(sumLiquido(rows) - totalLiquido) <= 1;
}
