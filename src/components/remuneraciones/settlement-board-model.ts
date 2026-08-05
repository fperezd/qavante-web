/* Modelo PURO de la conciliación de sueldos por trabajador (#835). Normaliza el board GENÉRICO del
   backend (sin schema en el OpenAPI) a tipos FE, deriva los candidatos de débito desde la cartola y
   arma el cuerpo del POST reconcile. Sin React → testeable. El backend es la fuente de verdad del
   estado conciliado; el FE sólo presenta y arma requests. */

import { parseAmount } from "@/components/gestion/gestion-format";
import type { BankMovement } from "@/lib/api/treasury";
import type { PayrollReconcileBody } from "@/lib/api/payroll-settlements";

/** Un trabajador del período con su saldo por conciliar. */
export interface SettlementWorker {
  workerRut: string;
  workerName: string;
  liquido: number;
  paidAmount: number;
  outstanding: number;
  /** Estado crudo del backend (informativo); el FE decide "pendiente" por `outstanding`. */
  status: string;
}

/** Una aplicación ya hecha (débito ↔ trabajador). Se puede DESASIGNAR por `linkId`. */
export interface SettlementLink {
  linkId: string;
  workerRut: string;
  workerName: string;
  amount: number;
  bankMovementId: string;
  glosa: string;
  createdAt: string;
}

export interface SettlementBoard {
  workers: SettlementWorker[];
  periodOutstanding: number;
  links: SettlementLink[];
}

/** Un débito del banco candidato a asignar (aún sin conciliar). */
export interface DebitoCandidato {
  id: string;
  date: string;
  glosa: string;
  monto: number;
}

/** Tolerancia (CLP) para tratar un saldo como "conciliado": redondeo acumulado del backend con
 *  muchos empleados puede dejar centavos. $1 es lo que ya usa la conciliación por-monto. */
export const CONCILIADO_TOL = 1;

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
/** Monto desde el board genérico: acepta number o string Decimal (`parseAmount` es string-only). */
function amt(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") return parseAmount(v);
  return 0;
}

/** Board genérico del backend → `SettlementBoard` tipado. Defensivo: campos ausentes caen a vacío/0,
 *  montos vía `parseAmount` (acepta string Decimal o number). */
export function normalizeBoard(raw: unknown): SettlementBoard {
  const o = (raw ?? {}) as Record<string, unknown>;
  const workers = asArray(o.workers).map((w) => {
    const r = (w ?? {}) as Record<string, unknown>;
    return {
      workerRut: str(r.worker_rut),
      workerName: str(r.worker_name),
      liquido: amt(r.liquido),
      paidAmount: amt(r.paid_amount),
      outstanding: amt(r.outstanding),
      status: str(r.status),
    } satisfies SettlementWorker;
  });
  const links = asArray(o.links).map((l) => {
    const r = (l ?? {}) as Record<string, unknown>;
    return {
      linkId: str(r.link_id),
      workerRut: str(r.worker_rut),
      workerName: str(r.worker_name),
      amount: amt(r.amount),
      bankMovementId: str(r.bank_movement_id),
      glosa: str(r.glosa),
      createdAt: str(r.created_at),
    } satisfies SettlementLink;
  });
  return { workers, periodOutstanding: amt(o.period_outstanding), links };
}

/** `true` si el trabajador todavía debe conciliar plata (saldo > tolerancia). */
export function workerPendiente(w: SettlementWorker): boolean {
  return w.outstanding > CONCILIADO_TOL;
}

/** "YYYY-MM" (o "YYYY-MM-DD") → "YYYYMM" para el path del board/reconcile. */
export function periodToYyyymm(period: string): string {
  return period.replace(/-/g, "").slice(0, 6);
}

/** Candidatos de débito: movimientos de sueldos (categoría payroll) egresos, que NO estén YA
 *  asignados en el board (su id no aparece en `links`). Ordenados por fecha desc (regla de grillas).
 *  Filtra por categoría payroll para no ofrecer TODA la cartola; si el backend no la marca, igual
 *  cae fuera y no aparece (mejor no ofrecer de más en una acción que mueve plata). */
export function debitosCandidatos(
  items: BankMovement[],
  board: SettlementBoard,
): DebitoCandidato[] {
  const asignados = new Set(board.links.map((l) => l.bankMovementId));
  return items
    .filter((m) => esDebito(m) && esPayroll(m) && !asignados.has(m.id))
    .map((m) => ({
      id: m.id,
      date: m.date,
      glosa: m.description ?? "",
      monto: Math.abs(parseAmount(m.amount)),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function esDebito(m: BankMovement): boolean {
  // Egreso: `direction` "debit"/"egreso"/"out", o monto negativo si el signo lo trae.
  const dir = (m.direction ?? "").toLowerCase();
  if (dir.includes("deb") || dir.includes("egres") || dir === "out") return true;
  return parseAmount(m.amount) < 0;
}

function esPayroll(m: BankMovement): boolean {
  const cat = (m.canonical_category ?? "").toLowerCase();
  return cat.includes("payroll") || cat.includes("sueldo") || cat.includes("remun");
}

/** Arma el cuerpo del POST reconcile para asignar un débito a uno o varios trabajadores. */
export function buildReconcileBody(
  period: string,
  debito: DebitoCandidato,
  workerRuts: string[],
  dryRun: boolean,
): PayrollReconcileBody {
  return {
    period: periodToYyyymm(period),
    amount: debito.monto,
    bank_movement_id: debito.id,
    worker_ruts: workerRuts,
    dry_run: dryRun,
  };
}
