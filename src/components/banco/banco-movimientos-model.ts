/* Modelo PURO del detalle de movimientos de Banco (#detalle). Sin React → testeable.
   - CUENTA: los movimientos salen de `/api/bank-movements` (stored, rápido, filtrable por mes). El
     `SaldoResponse` de bice da el `numeroFormateado` de la cuenta; `bice/accounts` lo mapea a su
     `linked_bank_account_id`, con el que filtramos los movimientos. (No usamos la cartola live: lenta.)
   - TARJETA: `/api/bice/tarjetas/{op}/movimientos` devuelve una ventana; filtramos por mes en el FE. */

import { parseAmount } from "@/components/gestion/gestion-format";
import type { BankMovement, TarjetaMovimiento } from "@/lib/api/treasury";
import type { components } from "@/lib/api/types";

/** Estado de conciliación de un movimiento de cuenta (banco). `null` = no aplica (tarjeta). */
export type EstadoConciliacion =
  | "conciliado"
  | "parcial"
  | "por_conciliar"
  | "excluido"
  | "no_requerido";
export type EstadoClasificacion = "clasificado" | "por_clasificar" | "revision";

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
  /** Estado independiente de la clasificación contable/financiera. */
  estadoClasificacion?: EstadoClasificacion | null;
  /** Nº de documento del banco, si lo trae. */
  documento?: string | null;
  /** Extra de tarjeta: cuotas ("1 de 3"), si aplica. */
  cuotas?: string | null;
}

/** `reconciliation_status` del backend → estado legible. "por conciliar" = pendiente (unmatched/…). */
export function estadoConciliacion(status: string | null | undefined): EstadoConciliacion {
  const s = (status ?? "").toLowerCase();
  if (s.includes("exclud") || s.includes("exclu")) return "excluido";
  if (s === "matched" || s === "reconciled") return "conciliado";
  if (s === "partial" || s === "partially_matched") return "parcial";
  if (s === "prepago" || s === "processor_batch" || s === "not_required") {
    return "no_requerido";
  }
  return "por_conciliar";
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
): MovimientoBanco[] {
  if (!bankAccountId) return [];
  return items
    .filter((m) => m.bank_account_id === bankAccountId)
    .map((m) => {
      const monto = montoFirmado(m);
      return {
        id: m.id,
        fecha: m.date,
        glosa: m.description ?? "Sin información",
        monto,
        // La moneda pertenece al movimiento. La cuenta puede ser multi-moneda y `null`
        // significa que ninguna fuente entregó evidencia: nunca lo aplastamos a CLP.
        moneda: m.currency_code?.trim().toUpperCase() || "S/D",
        esAbono: monto >= 0,
        estado: estadoConciliacion(m.effective_reconciliation_status ?? m.reconciliation_status),
        estadoClasificacion: estadoClasificacion(m),
        documento: m.external_id ?? null,
      } satisfies MovimientoBanco;
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

export function estadoClasificacion(
  movement: Pick<
    BankMovement,
    "classification_status" | "canonical_category" | "management_account_id"
  >,
): EstadoClasificacion {
  const status = (movement.classification_status ?? "").toLowerCase();
  const tieneDestino = Boolean(
    movement.canonical_category?.trim() || movement.management_account_id?.trim(),
  );
  if (status === "classified" && tieneDestino) return "clasificado";
  if (status === "review" || status === "needs_review") return "revision";
  return "por_clasificar";
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
        glosa: m.description ?? "Sin información",
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
  /** Snapshot canónico de `ReviewItem`; la mesa no reutiliza `/bank-movements` para mostrarlo. */
  movimiento: MovimientoRevisionConciliacion;
  /** "receivable" (cobro) | "payable" (pago) | otro. */
  kind: string;
  /** Nombre del documento/contraparte sugerido. */
  nombre: string | null;
  /** Score 0-100 (confianza del match); `null` si el backend no lo trae. */
  score: number | null;
  /** Cuántos documentos cubre la sugerencia; `null` si el API no publicó el snapshot completo. */
  documentCount: number | null;
  /** Topología publicada por el API; `null` evita atribuir una a una respuesta incompleta. */
  topology: string | null;
  reasons: string[];
  eligibility: string[];
  canConfirm: boolean;
  bulkEligible: boolean;
  documents: DocumentoSugeridoConciliacion[];
}

export interface MovimientoRevisionConciliacion {
  fecha: string | null;
  monto: number | null;
  direccion: "credit" | "debit" | null;
  moneda: string | null;
  glosa: string | null;
  /** Sólo un snapshot financiero completo puede habilitar acciones de conciliación. */
  completo: boolean;
}

export interface DocumentoSugeridoConciliacion {
  documentId: string;
  kind: string;
  documentType: number | null;
  folio: string | null;
  rut: string | null;
  nombre: string | null;
  monto: number;
  fecha: string | null;
  vencimiento: string | null;
  sourceProvider: string | null;
}

type ReviewItemLike = components["schemas"]["ReviewItem"];

function snapshotMovimientoRevision(item: ReviewItemLike): MovimientoRevisionConciliacion {
  const fecha = item.date?.trim() || null;
  const glosa = item.description?.trim() || null;
  const moneda = item.currency_code?.trim().toUpperCase() || null;
  const direccion =
    item.direction === "credit" || item.direction === "debit" ? item.direction : null;
  const monto =
    typeof item.amount === "string" && item.amount.trim() !== "" ? parseAmount(item.amount) : null;
  const montoValido = monto != null && Number.isFinite(monto);

  return {
    fecha,
    monto: montoValido ? monto : null,
    direccion,
    moneda,
    glosa,
    completo: fecha != null && montoValido && direccion != null && moneda != null && glosa != null,
  };
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
    const movimiento = snapshotMovimientoRevision(it);
    const documents = (s.documents ?? []).map((doc) => ({
      documentId: doc.document_id,
      kind: doc.kind,
      documentType: doc.document_type ?? null,
      folio: doc.folio?.trim() || null,
      rut: doc.rut?.trim() || null,
      nombre: doc.name?.trim() || null,
      monto: parseAmount(doc.amount),
      fecha: doc.date ?? null,
      vencimiento: doc.due_date ?? null,
      sourceProvider: doc.source_provider ?? null,
    }));
    const documentosCompletos =
      typeof s.document_count === "number" &&
      s.document_count > 0 &&
      documents.length === s.document_count;
    map.set(it.movement_id, {
      movementId: it.movement_id,
      movimiento,
      kind: s.document_kind ?? "",
      nombre: s.name?.trim() || null,
      score: score != null && Number.isFinite(score) ? score : null,
      documentCount: documentosCompletos ? s.document_count : null,
      topology: documentosCompletos ? s.topology : null,
      reasons: s.reasons ?? [],
      eligibility: s.eligibility ?? [],
      canConfirm: movimiento.completo && documentosCompletos && s.can_confirm,
      bulkEligible: movimiento.completo && documentosCompletos && s.bulk_eligible,
      documents,
    });
  }
  return map;
}

/** Tab activo de la lista de movimientos (estilo Chipax). "sugerencias" = con match propuesto (Fase 2). */
export type MovTab =
  | "todos"
  | "sugerencias"
  | "abonos"
  | "cargos"
  | "por_conciliar"
  | "por_clasificar";

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
    if (tab === "por_conciliar" && m.estado !== "por_conciliar" && m.estado !== "parcial") {
      return false;
    }
    if (tab === "por_clasificar" && m.estadoClasificacion !== "por_clasificar") return false;
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
  porClasificar: number;
} {
  return {
    abonos: movs.filter((m) => m.esAbono).length,
    cargos: movs.filter((m) => !m.esAbono).length,
    porConciliar: movs.filter((m) => m.estado === "por_conciliar" || m.estado === "parcial").length,
    sugerencias: conSugerencia
      ? movs.filter((m) => m.id != null && conSugerencia.has(m.id)).length
      : 0,
    porClasificar: movs.filter((m) => m.estadoClasificacion === "por_clasificar").length,
  };
}
