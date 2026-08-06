/* Modelo PURO del detalle de movimientos de Banco (#detalle). Sin React → testeable.
   - CUENTA: los movimientos salen de `/api/bank-movements` (stored, rápido, filtrable por mes). El
     `SaldoResponse` de bice da el `numeroFormateado` de la cuenta; `bice/accounts` lo mapea a su
     `linked_bank_account_id`, con el que filtramos los movimientos. (No usamos la cartola live: lenta.)
   - TARJETA: `/api/bice/tarjetas/{op}/movimientos` devuelve una ventana; filtramos por mes en el FE. */

import { parseAmount } from "@/components/gestion/gestion-format";
import type { BankMovement, TarjetaMovimiento } from "@/lib/api/treasury";

/** Estado de conciliación de un movimiento de cuenta (banco). `null` = no aplica (tarjeta). */
export type EstadoConciliacion = "conciliado" | "por_conciliar" | "excluido";

/** Un movimiento normalizado para la lista del detalle. `monto` FIRMADO (negativo = egreso/cargo). */
export interface MovimientoBanco {
  /** Id del movimiento (para conciliar por movimiento — Fase 2). */
  id?: string;
  fecha: string;
  glosa: string;
  monto: number;
  moneda: string;
  /** `true` = abono (ingreso), `false` = cargo (egreso). */
  esAbono: boolean;
  /** Estado de conciliación (solo cuentas); `null` en tarjeta. */
  estado?: EstadoConciliacion | null;
  /** Nº de documento del banco, si lo trae. */
  documento?: string | null;
  /** Extra de tarjeta: cuotas ("1 de 3"), si aplica. */
  cuotas?: string | null;
}

/** `reconciliation_status` del backend → estado legible. "por conciliar" = pendiente (unmatched/…). */
export function estadoConciliacion(status: string | null | undefined): EstadoConciliacion {
  const s = (status ?? "").toLowerCase();
  if (s.includes("exclud") || s.includes("exclu")) return "excluido";
  if (
    s === "" ||
    s.includes("unrecon") ||
    s.includes("unmatch") ||
    s.includes("pend") ||
    s.includes("review")
  )
    return "por_conciliar";
  return "conciliado";
}

interface BiceAccountLike {
  external_id?: string | null;
  linked_bank_account_id?: string | null;
}

/** El `bank_account_id` (Qavante) de una cuenta bice, por su `numeroFormateado` (= `external_id` en
 *  `bice/accounts`). `null` si no está vinculada / no matchea. */
export function bankAccountIdDeCuenta(
  biceAccounts: BiceAccountLike[] | undefined,
  numeroFormateado: string | null | undefined,
): string | null {
  if (!numeroFormateado) return null;
  const hit = (biceAccounts ?? []).find((a) => a.external_id === numeroFormateado);
  return hit?.linked_bank_account_id ?? null;
}

/** Movimientos de una cuenta: los de `/api/bank-movements` cuyo `bank_account_id` calza. Firmados
 *  (egreso negativo), ordenados por fecha desc (regla de grillas). */
export function movimientosDeCuenta(
  items: BankMovement[],
  bankAccountId: string | null,
  moneda: string,
): MovimientoBanco[] {
  if (!bankAccountId) return [];
  return items
    .filter((m) => m.bank_account_id === bankAccountId)
    .map((m) => {
      const monto = montoFirmado(m);
      return {
        id: m.id,
        fecha: m.date,
        glosa: m.description ?? "—",
        monto,
        moneda,
        esAbono: monto >= 0,
        estado: estadoConciliacion(m.reconciliation_status),
        documento: m.external_id ?? null,
      } satisfies MovimientoBanco;
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** Monto firmado del movimiento de banco: el signo del `amount` si lo trae; si el `amount` viene en
 *  valor absoluto, lo firma por `direction` (débito = egreso = negativo). */
function montoFirmado(m: BankMovement): number {
  const raw = parseAmount(m.amount);
  if (raw < 0) return raw;
  const dir = (m.direction ?? "").toLowerCase();
  const esEgreso = dir.includes("deb") || dir.includes("egres") || dir === "out";
  return esEgreso ? -raw : raw;
}

/** "YYYY-MM" de una fecha en formatos comunes: ISO "YYYY-MM-DD…", "DD/MM/YYYY", "DD-MM-YYYY".
 *  `null` si no se puede inferir (no filtramos a ciegas). */
export function mesDeFecha(date: string | null | undefined): string | null {
  if (!date) return null;
  const iso = /^(\d{4})-(\d{2})/.exec(date);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const dmy = /^(\d{2})[/-](\d{2})[/-](\d{4})/.exec(date);
  if (dmy) return `${dmy[3]}-${dmy[2]}`;
  return null;
}

/** Movimientos de una tarjeta filtrados por mes ("YYYY-MM"). Si la fecha no se puede parsear, el
 *  movimiento se INCLUYE (mejor mostrarlo que ocultarlo por un formato raro). Ordena por fecha desc. */
export function movimientosDeTarjeta(
  movs: TarjetaMovimiento[] | undefined,
  period: string,
): MovimientoBanco[] {
  return (movs ?? [])
    .filter((m) => {
      const mes = mesDeFecha(m.date);
      return mes === null || mes === period;
    })
    .map((m) => {
      // `amount` de tarjeta llega como number (a diferencia del string de bank-movements) y en valor de
      // COMPRA (positivo). Un cargo es un egreso → lo firmamos negativo; un reverso (raw<0) queda abono.
      const raw = typeof m.amount === "number" ? m.amount : parseAmount(m.amount ?? "");
      const monto = -raw;
      return {
        fecha: m.date ?? "",
        glosa: m.description ?? "—",
        monto,
        moneda: (m.currency ?? "CLP").toUpperCase(),
        esAbono: monto >= 0,
        estado: null, // los cargos de tarjeta no tienen estado de conciliación bancaria
        cuotas: m.installmentsDescription ?? null,
      } satisfies MovimientoBanco;
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** Una sugerencia de conciliación para un movimiento (viene de la cola `reconciliation/review`). */
export interface SugerenciaConciliacion {
  movementId: string;
  /** "receivable" (cobro) | "payable" (pago) | otro. */
  kind: string;
  /** Nombre del documento/contraparte sugerido. */
  nombre: string;
  /** Score 0-100 (confianza del match); `null` si el backend no lo trae. */
  score: number | null;
  /** Cuántos documentos cubre la sugerencia (subset-sum / NC-netting cubren N). */
  documentCount: number;
}

interface ReviewItemLike {
  movement_id: string;
  suggestion?: {
    document_kind?: string;
    name?: string | null;
    score?: string | null;
    document_count?: number;
  } | null;
}

/** Mapa `movement_id → sugerencia` desde la cola de conciliación. Puro: no filtra por cuenta (eso lo
 *  hace el intersect con los movimientos visibles). Sugerencias sin `movement_id` se ignoran. */
export function mapaSugerencias(
  items: ReviewItemLike[] | undefined,
): Map<string, SugerenciaConciliacion> {
  const map = new Map<string, SugerenciaConciliacion>();
  for (const it of items ?? []) {
    const s = it.suggestion;
    if (!it.movement_id || !s) continue;
    const score = s.score != null && s.score !== "" ? Number(s.score) : null;
    map.set(it.movement_id, {
      movementId: it.movement_id,
      kind: s.document_kind ?? "",
      nombre: s.name ?? "—",
      score: score != null && Number.isFinite(score) ? score : null,
      documentCount: s.document_count ?? 1,
    });
  }
  return map;
}

/** Tab activo de la lista de movimientos (estilo Chipax). "sugerencias" = con match propuesto (Fase 2). */
export type MovTab = "todos" | "sugerencias" | "abonos" | "cargos" | "por_conciliar";

/** Filtra los movimientos por tab + texto de búsqueda (en la glosa). Puro. `conSugerencia` = ids con
 *  match propuesto (para el tab "sugerencias"). */
export function filtrarMovimientos(
  movs: MovimientoBanco[],
  tab: MovTab,
  texto: string,
  conSugerencia?: Set<string>,
): MovimientoBanco[] {
  const q = texto.trim().toLowerCase();
  return movs.filter((m) => {
    if (tab === "abonos" && !m.esAbono) return false;
    if (tab === "cargos" && m.esAbono) return false;
    if (tab === "por_conciliar" && m.estado !== "por_conciliar") return false;
    if (tab === "sugerencias" && !(m.id != null && conSugerencia?.has(m.id))) return false;
    if (q && !m.glosa.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Cuenta abonos / cargos / por-conciliar / con-sugerencia para los badges de los tabs. */
export function contarMovimientos(
  movs: MovimientoBanco[],
  conSugerencia?: Set<string>,
): {
  abonos: number;
  cargos: number;
  porConciliar: number;
  sugerencias: number;
} {
  return {
    abonos: movs.filter((m) => m.esAbono).length,
    cargos: movs.filter((m) => !m.esAbono).length,
    porConciliar: movs.filter((m) => m.estado === "por_conciliar").length,
    sugerencias: conSugerencia
      ? movs.filter((m) => m.id != null && conSugerencia.has(m.id)).length
      : 0,
  };
}
