/* Detalle de planilla POR EMPLEADO (para conciliación bancaria). PURO/testeable.
 *
 * Caso de uso (Fernando, owner): el líquido de cada trabajador se cruza contra
 * los débitos de sueldos del banco. Necesitamos, por empleado, `nombre + rut +
 * liquido` del período.
 *
 * CC-API lo expuso (ADR-0057): `GET /api/buk/payroll/detail?period=` →
 * `{ empleados: [{employee_id, nombre, rut, liquido}] }` (owner-only). Leemos
 * `empleados` (fallback al viejo `detalle` por robustez). Tolerante a nombres
 * alternativos de campo. */

import type { PayrollDetailResponse, PayrollResponse } from "@/lib/api/buk";

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

/** Lee el detalle por empleado (`empleados` del endpoint /payroll/detail; fallback
 *  al viejo `detalle`). Devuelve [] si no hay detalle (no-owner / sin planilla). */
export function normalizePayrollDetalle(
  data: PayrollDetailResponse | PayrollResponse | undefined,
): EmployeePayroll[] {
  const rec = data as Record<string, unknown> | undefined;
  const rows = rec?.empleados ?? rec?.detalle;
  if (!Array.isArray(rows)) return [];
  return rows.map((raw) => {
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

/** Montos "a pagar por la planilla" que NO son el líquido de los trabajadores:
 *  el impuesto de remuneraciones (Impuesto Único de 2ª Categoría) que se entera
 *  en el F29, y las cotizaciones previsionales que se pagan en Previred. Son los
 *  dos desembolsos que acompañan a cada planilla, además del líquido.
 *
 *  Contrato FE-first: CC-API extiende `PayrollTotales` con estos montos desde BUK
 *  (escalado por STATE). El tipo generado todavía no los declara → los leemos de
 *  forma tolerante (varios nombres candidatos). `null` = el conector aún no los
 *  expone (la UI lo muestra como "en preparación", no como $0). */
export interface PayrollObligaciones {
  /** Impuesto de remuneraciones a enterar en el F29 (IUSC retenido). null si falta. */
  impuestoF29: number | null;
  /** Cotizaciones previsionales a pagar en Previred (AFP/salud/AFC). null si falta. */
  previred: number | null;
}

export function readPayrollObligaciones(
  totales: Record<string, unknown> | undefined | null,
): PayrollObligaciones {
  const t = (totales ?? {}) as Record<string, unknown>;
  return {
    impuestoF29: firstNum(
      t.total_impuesto,
      t.total_impuestos,
      t.total_impuesto_unico,
      t.impuesto_unico,
      t.total_iusc,
      t.impuesto_f29,
    ),
    previred: firstNum(
      t.total_previred,
      t.previred,
      t.total_imposiciones,
      t.total_cotizaciones,
      t.total_cotizaciones_previsionales,
    ),
  };
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
