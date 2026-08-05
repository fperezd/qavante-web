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

/** Candidatos de débito para conciliar sueldos: egresos NO asignados aún (su id no aparece en `links`)
 *  que además parezcan un pago de nómina. "Parece nómina" por CUALQUIERA de dos señales:
 *   - categoría/glosa payroll ("payroll"/"sueldo"/"remun"/"nómina"), o
 *   - el monto CALZA EXACTO con el líquido por pagar de algún trabajador pendiente.
 *  El segundo criterio es clave con datos reales: los bancos NO categorizan la nómina — validado al
 *  peso contra Tooxs, los sueldos salen como "Transf. a terceros" sin categoría, pero por el monto
 *  exacto del líquido (ej. $5.582.113 = un trabajador). Sin él, la lista salía vacía y no se podía
 *  conciliar nada. Ordenados por fecha desc (regla de grillas). */
export function debitosCandidatos(
  items: BankMovement[],
  board: SettlementBoard,
): DebitoCandidato[] {
  const asignados = new Set(board.links.map((l) => l.bankMovementId));
  const montosPendientes = new Set(
    board.workers.filter(workerPendiente).map((w) => Math.round(w.outstanding)),
  );
  return items
    .filter((m) => esDebito(m) && !asignados.has(m.id) && pareceNomina(m, montosPendientes))
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

/** ¿Este egreso parece un pago de nómina? Regla (evita falsos positivos vistos al peso — un Pago TGR
 *  que calza un líquido de casualidad, una Comisión con "Nóminas" en la glosa):
 *   - si el banco lo categorizó como PAYROLL → sí;
 *   - si lo categorizó como OTRA cosa (tgr_payment, tax_payment, bank_fee, supplier_payment,
 *     social_security_payment, internal_bank_transfer…) → NO (le creemos a la categoría);
 *   - si NO tiene categoría → recién ahí usamos las señales débiles: glosa payroll o calce de monto
 *     exacto con el líquido de un trabajador pendiente.
 *  Siempre es una SUGERENCIA — el dueño confirma antes de aplicar (dry-run + confirmación). */
function pareceNomina(m: BankMovement, montosPendientes: Set<number>): boolean {
  const cat = (m.canonical_category ?? "").toLowerCase();
  if (cat.includes("payroll") || cat.includes("sueldo") || cat.includes("remun")) return true;
  if (cat !== "") return false; // categorizado como otra cosa → no es sueldo
  return glosaNomina(m) || calzaConTrabajador(m, montosPendientes);
}

function glosaNomina(m: BankMovement): boolean {
  const g = (m.description ?? "").toLowerCase();
  return g.includes("nómina") || g.includes("nomina") || g.includes("sueldo") || g.includes("remun");
}

/** El débito paga EXACTAMENTE el saldo pendiente de algún trabajador (transferencia individual del
 *  líquido). Es una SUGERENCIA — el dueño confirma antes de aplicar (dry-run + confirmación). */
function calzaConTrabajador(m: BankMovement, montosPendientes: Set<number>): boolean {
  return montosPendientes.has(Math.abs(Math.round(parseAmount(m.amount))));
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
