/* Lógica PURA de Cobrar v2 (rediseño 2026-07-19) — SIN React, testeable.
 *
 * Cobrar v2 convierte la pantalla de reporte en herramienta: contesta "¿a quién
 * le cobro primero?" y entrega acciones reales de cobranza. Dos modos honestos
 * (§13, "surface honesto"; regla "dato automático, no CRM"):
 *
 *   - URGENCIA: cuando el backend YA tiene vencimientos (algún deudor con mora),
 *     prioriza al más vencido — a quién perseguir.
 *   - CONCENTRACIÓN: cuando NO hay vencimientos todavía (el SII aún no entrega
 *     las fechas — `data_state:"partial"`, `overdue` en 0), no inventa urgencia:
 *     prioriza por tamaño y lo dice ("no sabemos qué está vencido").
 *
 * Las acciones (copiar recordatorio, WhatsApp, mail) NO asumen CRM: prellenan el
 * mensaje y el gerente elige el destinatario (no tenemos teléfono/mail del cliente).
 * "Marcar gestionado" se persiste en las prefs de UI (`/api/me/preferences`, #571;
 * blob que "reemplaza, no mergea" — ver `withGestionado`). */

import type { AccountsReceivableResponse, TopDebtor } from "@/lib/api/cobranza";
import type { PreferencesBlob } from "@/lib/api/preferences";
import { normalizeRut } from "@/lib/validators/rut";
import { formatClp } from "@/lib/formatters/clp";
import { parseAmount, sortByUrgency, shareOfTotal } from "../cobranza-format";

export type PrioridadMode = "urgencia" | "concentracion";

export interface Prioridad {
  /** `urgencia` = hay mora conocida; `concentracion` = sin vencimientos, se prioriza por tamaño. */
  mode: PrioridadMode;
  debtor: TopDebtor;
  /** Total que debe este cliente (CLP). */
  total: number;
  /** Vencido de este cliente (CLP). 0 en modo concentración. */
  overdue: number;
  /** Qué parte del total por cobrar es este cliente (%). Señal de concentración. */
  pctDelTotal: number;
  /** Total por cobrar de la empresa (CLP). */
  grandTotal: number;
}

/** Ordena deudores por TAMAÑO (mayor total primero) — el criterio del modo
 *  concentración, cuando no hay vencimientos para priorizar por mora. PURO. */
export function sortByTotal<T extends { total: string }>(items: ReadonlyArray<T>): T[] {
  return [...items].sort((a, b) => parseAmount(b.total) - parseAmount(a.total));
}

/** Elige a quién cobrarle primero y en qué modo. `null` si no hay deudores.
 *  El modo lo decide el DATO: si algún deudor tiene mora → urgencia; si no → concentración. */
export function pickPrioridad(data: AccountsReceivableResponse): Prioridad | null {
  const debtors = data.top_debtors ?? [];
  if (debtors.length === 0) return null;
  const anyOverdue = debtors.some((d) => parseAmount(d.overdue) > 0);
  const ordered = anyOverdue ? sortByUrgency(debtors) : sortByTotal(debtors);
  const top = ordered[0]!;
  return {
    mode: anyOverdue ? "urgencia" : "concentracion",
    debtor: top,
    total: parseAmount(top.total),
    overdue: parseAmount(top.overdue),
    pctDelTotal: shareOfTotal(top.total, data.total),
    grandTotal: parseAmount(data.total),
  };
}

/** Recordatorio de cobranza listo para enviar, en español chileno neutro (formal,
 *  sin voseo). No incluye datos de contacto (no los tenemos): el gerente lo pega en
 *  el canal que quiera. El texto cambia según haya mora conocida o no. PURO. */
export function reminderText(p: {
  name: string;
  total: number;
  overdue: number;
  mode: PrioridadMode;
}): string {
  const saludo = `Estimados ${p.name.trim()}:`;
  const cierre = "Quedo atento a su confirmación. Muchas gracias.";
  if (p.mode === "urgencia" && p.overdue > 0) {
    return [
      saludo,
      "",
      `Junto con saludar, escribo para regularizar los documentos vencidos que mantienen con nosotros, por ${formatClp(p.overdue)} (de un total de ${formatClp(p.total)} pendiente).`,
      "",
      `¿Podríamos coordinar su pago a la brevedad? ${cierre}`,
    ].join("\n");
  }
  return [
    saludo,
    "",
    `Junto con saludar, escribo para coordinar el pago de los documentos pendientes que mantienen con nosotros, por un total de ${formatClp(p.total)}.`,
    "",
    `¿Podríamos revisar el estado de estas facturas y agendar su pago? ${cierre}`,
  ].join("\n");
}

/** Link "compartir por WhatsApp" con el texto prellenado. Sin número (no lo
 *  tenemos): abre WhatsApp para que el gerente elija el contacto. PURO. */
export function waHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** `mailto:` con asunto + cuerpo prellenados, sin destinatario (el gerente lo
 *  completa). PURO. */
export function mailtoHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ── "Marcar gestionado" — persistido en las prefs de UI (blob opaco #571) ──────
 * Mapa `rut normalizado → fecha ISO en que se marcó`. Permite al gerente llevar
 * la cuenta de a quién ya contactó este ciclo. El blob "reemplaza, no mergea":
 * los `with*` devuelven el blob COMPLETO con solo esta clave tocada. */

export const GESTIONADO_KEY = "cobranza_gestionado";

/** rut normalizado → fecha ISO (YYYY-MM-DD) en que se marcó gestionado. */
export type GestionadoMap = Record<string, string>;

/** Lee el mapa de gestionados del blob. Defensivo: el blob es `unknown`, así que
 *  solo acepta un objeto plano de string→string; cualquier otra forma → `{}`. */
export function readGestionado(blob: PreferencesBlob | undefined): GestionadoMap {
  const v = blob?.[GESTIONADO_KEY];
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: GestionadoMap = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

/** ¿Este RUT está marcado gestionado? (normaliza el RUT internamente). */
export function isGestionado(map: GestionadoMap, rut: string): boolean {
  return typeof map[normalizeRut(rut)] === "string";
}

/** Blob COMPLETO con el RUT marcado gestionado en `isoDate` (respeta "reemplaza,
 *  no mergea": preserva el resto de las prefs y solo toca esta clave). */
export function withGestionado(
  blob: PreferencesBlob | undefined,
  rut: string,
  isoDate: string,
): PreferencesBlob {
  const cur = readGestionado(blob);
  return { ...(blob ?? {}), [GESTIONADO_KEY]: { ...cur, [normalizeRut(rut)]: isoDate } };
}

/** Blob COMPLETO con el RUT desmarcado (deshacer "gestionado"). */
export function withoutGestionado(blob: PreferencesBlob | undefined, rut: string): PreferencesBlob {
  const cur = { ...readGestionado(blob) };
  delete cur[normalizeRut(rut)];
  return { ...(blob ?? {}), [GESTIONADO_KEY]: cur };
}

/** Orden de la lista de deudores para el gerente: primero los PENDIENTES (por
 *  urgencia si hay mora, si no por tamaño), y al fondo los ya gestionados
 *  (preservando su orden relativo). PURO — no muta la entrada. */
export function sortDebtors(
  debtors: ReadonlyArray<TopDebtor>,
  gestionado: GestionadoMap,
): TopDebtor[] {
  const anyOverdue = debtors.some((d) => parseAmount(d.overdue) > 0);
  const base = anyOverdue ? sortByUrgency(debtors) : sortByTotal(debtors);
  const pend = base.filter((d) => !isGestionado(gestionado, d.rut));
  const done = base.filter((d) => isGestionado(gestionado, d.rut));
  return [...pend, ...done];
}
