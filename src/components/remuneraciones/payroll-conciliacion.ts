/* Cruce (conciliación) del líquido por empleado contra los débitos del banco.
 * PURO/testeable. NO calcula finanzas (§17.4): solo empareja montos ya provistos.
 *
 * Caso de uso: cada trabajador recibe su líquido por transferencia → aparece
 * como un DÉBITO en la cartola. Matcheamos por MONTO (el líquido == el débito),
 * 1-a-1 (un débito no se usa dos veces). Sirve para ver, del pago de sueldos:
 * qué empleados están conciliados, cuáles faltan (¿no pagados?), y qué débitos
 * quedaron sin empleado (¿no eran sueldo?). */

import type { EmployeePayroll } from "./payroll-detalle";

/** Forma mínima de un movimiento bancario para el cruce (subset de BankMovement). */
export interface BankDebitLike {
  id: string;
  date?: string;
  description?: string;
  /** El backend expone `amount` como string; aceptamos number también. */
  amount?: string | number;
  direction?: string;
}

export interface MatchPair {
  empleado: EmployeePayroll;
  movimiento: BankDebitLike;
}

export interface ConciliacionResult {
  /** Empleados con un débito bancario del mismo monto. */
  matched: MatchPair[];
  /** Empleados sin débito que los cubra (líquido null o sin match). */
  unmatchedEmpleados: EmployeePayroll[];
  /** Débitos sin empleado asociado (posibles no-sueldos). */
  unmatchedDebitos: BankDebitLike[];
}

function toNum(v: string | number | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Monto absoluto del movimiento (los débitos pueden venir negativos o positivos). */
function mag(v: string | number | undefined): number | null {
  const n = toNum(v);
  return n === null ? null : Math.abs(n);
}

/** Empareja líquidos de empleados con débitos bancarios por monto (1-a-1, greedy). */
export function matchPayrollToBank(
  empleados: EmployeePayroll[],
  movimientos: BankDebitLike[],
): ConciliacionResult {
  // Solo débitos (dinero que sale). Sin `direction` asumimos débito (fuente ya filtrada).
  const debitos = movimientos.filter(
    (m) => (m.direction ?? "debit") === "debit" && mag(m.amount) !== null,
  );

  const usados = new Set<string>();
  const matched: MatchPair[] = [];
  const unmatchedEmpleados: EmployeePayroll[] = [];

  for (const e of empleados) {
    if (e.liquido === null) {
      unmatchedEmpleados.push(e);
      continue;
    }
    const hit = debitos.find((d) => !usados.has(d.id) && mag(d.amount) === e.liquido);
    if (hit) {
      usados.add(hit.id);
      matched.push({ empleado: e, movimiento: hit });
    } else {
      unmatchedEmpleados.push(e);
    }
  }

  const unmatchedDebitos = debitos.filter((d) => !usados.has(d.id));
  return { matched, unmatchedEmpleados, unmatchedDebitos };
}

/** Resumen para el encabezado (N de M conciliados + monto conciliado). */
export function resumenConciliacion(result: ConciliacionResult) {
  const totalEmpleados = result.matched.length + result.unmatchedEmpleados.length;
  const montoConciliado = result.matched.reduce((acc, m) => acc + (m.empleado.liquido ?? 0), 0);
  return {
    conciliados: result.matched.length,
    totalEmpleados,
    montoConciliado,
    empleadosPendientes: result.unmatchedEmpleados.length,
    debitosSinAsignar: result.unmatchedDebitos.length,
  };
}
