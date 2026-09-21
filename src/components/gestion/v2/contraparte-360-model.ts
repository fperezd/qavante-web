/* Modelo PURO del 360 de una contraparte (cliente o proveedor), sin React → testeable. Opera sobre
   los `DocConVencimiento` del maestro (RCV ventas o compras, ~24 meses) y deriva: agregado por
   contraparte, serie mensual continua, tendencia año-contra-año, estacionalidad y concentración.
   Simétrico: la MISMA lógica sirve para el 360 de ventas (clientes) y el de compras (proveedores);
   la vista cambia el lenguaje. Todo del contrato que ya existe; no inventa "días de pago real"
   (eso es el comportamiento_pago = brecha de CC-API, ver STATE_OF_THE_TRAIN). */

import type { DocConVencimiento } from "@/components/terminos/terminos-pago";
import { addMonths, comparePeriod } from "@/lib/period/period-range";
import { normalizeRut } from "@/lib/validators/rut";
import { isNotaCredito } from "@/components/sii/tipo-doc";

export interface Customer360Scope {
  periodFrom: string;
  periodTo: string;
  /** Instante real capturado una vez al montar la vista. */
  asOf: string;
  /** Día calendario del instante anterior en `America/Santiago`. */
  asOfDate: string;
  timeZone: "America/Santiago";
}

export interface Customer360Document {
  sourcePeriod: string;
  sourceIndex: number;
  rut: string;
  name: string;
  fecha: string;
  /** `null` conserva monto ausente/inválido; cero sólo significa cero observado. */
  monto: number | null;
  folio: number | string | null;
  tipoDoc?: number;
  refFolio?: number;
  refTipoDoc?: number;
  reclamado?: boolean;
}

export type ValidCustomer360Document = Customer360Document & { monto: number };

export type Customer360DocumentKind = "credit_note" | "debit_note" | "positive_document";

const CREDIT_NOTE_CODES = new Set([60, 61, 112]);
const DEBIT_NOTE_CODES = new Set([56, 111]);
const WEAK_IDENTITIES = new Set(["55555555-5", "SIN-RUT", "S/D"]);
const WEAK_IDENTITY_TOKENS = new Set(["555555555", "SINRUT", "SD"]);

export function customer360DocumentKind(
  tipoDoc: number | null | undefined,
): Customer360DocumentKind {
  if (tipoDoc != null && CREDIT_NOTE_CODES.has(tipoDoc)) return "credit_note";
  if (tipoDoc != null && DEBIT_NOTE_CODES.has(tipoDoc)) return "debit_note";
  return "positive_document";
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/** Fecha del documento como `YYYY-MM-DD`, sin depender del timezone del navegador. */
export function customer360DocumentDate(fecha: string): string | null {
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})(?:\D|$)/.exec(fecha);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    return validCalendarDate(year, month, day) ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:\D|$)/.exec(fecha);
  if (!iso) return null;
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  return validCalendarDate(year, month, day) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

/** Una sola población de foco, siempre con cota inferior, superior y corte `as_of`. */
export function filterCustomer360FocusDocs(
  docs: ReadonlyArray<Customer360Document>,
  scope: Customer360Scope,
): Customer360Document[] {
  return docs.filter((doc) => {
    const date = customer360DocumentDate(doc.fecha);
    if (!date) return false;
    const period = date.slice(0, 7);
    return (
      comparePeriod(period, scope.periodFrom) >= 0 &&
      comparePeriod(period, scope.periodTo) <= 0 &&
      date <= scope.asOfDate
    );
  });
}

function hasWeakIdentity(doc: Customer360Document): boolean {
  const rawToken = doc.rut
    .trim()
    .replace(/[.\-\s/]/g, "")
    .toUpperCase();
  const normalized = normalizeRut(doc.rut);
  return normalized === "" || WEAK_IDENTITIES.has(normalized) || WEAK_IDENTITY_TOKENS.has(rawToken);
}

function canonicalDocumentIdentity(doc: Customer360Document): string | null {
  const rut = normalizeRut(doc.rut);
  const folio = doc.folio == null ? "" : String(doc.folio).trim();
  if (!rut || doc.tipoDoc == null || folio === "") return null;
  return `${rut}|${doc.tipoDoc}|${folio}`;
}

function canonicalDocumentEvidence(doc: Customer360Document): string {
  return JSON.stringify({
    rut: normalizeRut(doc.rut),
    name: doc.name.trim(),
    fecha: customer360DocumentDate(doc.fecha) ?? doc.fecha.trim(),
    monto: doc.monto,
    folio: doc.folio == null ? null : String(doc.folio).trim(),
    tipoDoc: doc.tipoDoc ?? null,
    refFolio: doc.refFolio ?? null,
    refTipoDoc: doc.refTipoDoc ?? null,
    reclamado: doc.reclamado === true,
  });
}

export interface Customer360Deduplication {
  docs: Customer360Document[];
  /** Identidades ausentes o repetidas con evidencia contradictoria. */
  ambiguousIdentities: number;
}

/**
 * Deduplica sólo repeticiones materialmente idénticas de la identidad fiscal
 * contraparte + tipo + folio. Una identidad ausente o con payloads distintos se conserva como
 * evidencia y obliga a abstener: nunca resolvemos una colisión eligiendo silenciosamente una fila.
 */
export function deduplicateCustomer360Documents(
  docs: ReadonlyArray<Customer360Document>,
): Customer360Deduplication {
  const unique: Customer360Document[] = [];
  const firstByIdentity = new Map<string, string>();
  const ambiguous = new Set<string>();

  for (const doc of docs) {
    const identity = canonicalDocumentIdentity(doc);
    if (!identity) {
      ambiguous.add(`missing:${doc.sourcePeriod}:${doc.sourceIndex}`);
      unique.push(doc);
      continue;
    }
    const evidence = canonicalDocumentEvidence(doc);
    const first = firstByIdentity.get(identity);
    if (!first) {
      firstByIdentity.set(identity, evidence);
      unique.push(doc);
      continue;
    }
    if (first !== evidence) {
      ambiguous.add(identity);
      unique.push(doc);
    }
  }

  return { docs: unique, ambiguousIdentities: ambiguous.size };
}

export type Customer360AbstainReason =
  | "period_coverage_incomplete"
  | "invalid_document_date"
  | "invalid_document_amount"
  | "unresolved_counterparty_identity"
  | "ambiguous_document_identity";

export interface Customer360Validation {
  canAggregate: boolean;
  reasons: Customer360AbstainReason[];
  docs: ValidCustomer360Document[];
}

/** Gate único previo a cualquier tarjeta/ranking/concentración. No elimina filas problemáticas.
 * `canAggregatePeriods` significa que existe al menos un mes observado: los meses no observados
 * se declaran como cobertura parcial, no se convierten en cero ni bloquean la evidencia válida. */
export function validateCustomer360Documents(
  docs: ReadonlyArray<Customer360Document>,
  canAggregatePeriods: boolean,
  invalidDateDocuments = 0,
  ambiguousDocumentIdentities = 0,
): Customer360Validation {
  const reasons: Customer360AbstainReason[] = [];
  if (!canAggregatePeriods) reasons.push("period_coverage_incomplete");
  if (invalidDateDocuments > 0) reasons.push("invalid_document_date");
  if (docs.some((doc) => doc.monto === null)) reasons.push("invalid_document_amount");
  if (docs.some(hasWeakIdentity)) reasons.push("unresolved_counterparty_identity");
  if (ambiguousDocumentIdentities > 0) reasons.push("ambiguous_document_identity");
  const canAggregate = reasons.length === 0;
  return {
    canAggregate,
    reasons,
    docs: canAggregate ? (docs as ValidCustomer360Document[]) : [],
  };
}

export interface Customer360AmountBreakdown {
  positiveDocumentsGross: number;
  debitNotesGross: number;
  creditNotesGross: number;
  reclaimedGross: number;
  reclaimedCount: number;
}

function emptyBreakdown(): Customer360AmountBreakdown {
  return {
    positiveDocumentsGross: 0,
    debitNotesGross: 0,
    creditNotesGross: 0,
    reclaimedGross: 0,
    reclaimedCount: 0,
  };
}

export function customer360SignedAmount(doc: ValidCustomer360Document): number {
  if (doc.reclamado) return 0;
  const amount = Math.abs(doc.monto);
  return customer360DocumentKind(doc.tipoDoc) === "credit_note" ? -amount : amount;
}

function addToBreakdown(target: Customer360AmountBreakdown, doc: ValidCustomer360Document): void {
  const amount = Math.abs(doc.monto);
  if (doc.reclamado) {
    target.reclaimedGross += amount;
    target.reclaimedCount += 1;
    return;
  }
  const kind = customer360DocumentKind(doc.tipoDoc);
  if (kind === "credit_note") target.creditNotesGross += amount;
  else if (kind === "debit_note") target.debitNotesGross += amount;
  else target.positiveDocumentsGross += amount;
}

export interface Customer360Counterparty {
  rut: string;
  name: string;
  total: number;
  docs: number;
  primerPeriodo: string;
  ultimoPeriodo: string;
  breakdown: Customer360AmountBreakdown;
}

/** Agrupación permitida sólo después de `validateCustomer360Documents`. */
export function aggregateCustomer360Counterparties(
  docs: ReadonlyArray<ValidCustomer360Document>,
): Customer360Counterparty[] {
  const map = new Map<string, Customer360Counterparty>();
  for (const doc of docs) {
    const period = customer360DocumentDate(doc.fecha)?.slice(0, 7);
    if (!period) continue;
    const rut = normalizeRut(doc.rut);
    const current = map.get(rut);
    if (!current) {
      const breakdown = emptyBreakdown();
      addToBreakdown(breakdown, doc);
      map.set(rut, {
        rut,
        name: doc.name || rut,
        total: customer360SignedAmount(doc),
        docs: 1,
        primerPeriodo: period,
        ultimoPeriodo: period,
        breakdown,
      });
      continue;
    }
    current.total += customer360SignedAmount(doc);
    current.docs += 1;
    addToBreakdown(current.breakdown, doc);
    if (comparePeriod(period, current.primerPeriodo) < 0) current.primerPeriodo = period;
    if (comparePeriod(period, current.ultimoPeriodo) > 0) current.ultimoPeriodo = period;
    if (current.name === rut && doc.name && doc.name !== rut) current.name = doc.name;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** Serie exacta del foco. El cero sólo se completa después del gate de 12/12 meses observados. */
export function customer360Series(
  docs: ReadonlyArray<ValidCustomer360Document>,
  rut: string,
  scope: Customer360Scope,
  observedPeriods?: ReadonlyArray<string>,
): PuntoMes[] {
  const normalized = normalizeRut(rut);
  const byPeriod = new Map<string, number>();
  for (const doc of docs) {
    if (normalizeRut(doc.rut) !== normalized) continue;
    const period = customer360DocumentDate(doc.fecha)?.slice(0, 7);
    if (!period) continue;
    byPeriod.set(period, (byPeriod.get(period) ?? 0) + customer360SignedAmount(doc));
  }
  const periods = observedPeriods ?? Array.from({ length: 12 }, (_, index) =>
    addMonths(scope.periodFrom, index),
  );
  return periods
    .filter(
      (period) =>
        comparePeriod(period, scope.periodFrom) >= 0 && comparePeriod(period, scope.periodTo) <= 0,
    )
    .map((period) => ({ periodo: period, monto: byPeriod.get(period) ?? 0 }));
}

/** Monto FIRMADO para netear: la NC resta; un doc reclamado no cuenta ($0). Magnitud → signo.
 *  Usa el canónico `isNotaCredito` (códigos 60, 61 y 112) — antes un set local omitía el 60 (NC no
 *  electrónica) e inflaba el 360, contradiciendo al maestro de Pagar/Cobrar que sí la netea. */
export function montoFirmado(d: DocConVencimiento): number {
  if (d.reclamado) return 0;
  const abs = Math.abs(d.monto) || 0;
  return isNotaCredito(d.tipoDoc) ? -abs : abs;
}

/** "DD/MM/YYYY" (RCV) o ISO "YYYY-MM-DD" → "YYYY-MM". `null` si no parsea. */
export function periodoDe(fecha: string): string | null {
  const dmy = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}`;
  const iso = fecha.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  return null;
}

export interface ContraparteAgregada {
  rut: string;
  name: string;
  /** Neto en la ventana (NC ya restadas). */
  total: number;
  docs: number;
  primerPeriodo: string;
  ultimoPeriodo: string;
}

/** Agrega los docs por contraparte (RUT): total neto, nº de docs y primer/último mes con actividad.
 *  Orden descendente por total (los que más pesan primero). */
export function agregarContrapartes(docs: DocConVencimiento[]): ContraparteAgregada[] {
  const map = new Map<
    string,
    { name: string; total: number; docs: number; min: string; max: string }
  >();
  for (const d of docs) {
    const per = periodoDe(d.fecha);
    if (!d.rut || !per) continue;
    const rut = normalizeRut(d.rut); // mismo RUT con/sin puntos NO se parte en dos filas
    const firm = montoFirmado(d);
    const cur = map.get(rut);
    if (!cur) {
      map.set(rut, { name: d.name || rut, total: firm, docs: 1, min: per, max: per });
    } else {
      cur.total += firm;
      cur.docs += 1;
      if (comparePeriod(per, cur.min) < 0) cur.min = per;
      if (comparePeriod(per, cur.max) > 0) cur.max = per;
      // Backfill del nombre: si el primer doc del RUT vino sin razón social, `name` quedó como el
      // RUT (placeholder) — un doc posterior con nombre real lo reemplaza (antes esta guarda era
      // `!cur.name`, código muerto: `name` nunca es falsy por el `d.name || rut` de arriba).
      if (cur.name === rut && d.name && d.name !== rut) cur.name = d.name;
    }
  }
  return [...map.entries()]
    .map(([rut, v]) => ({
      rut,
      name: v.name,
      total: v.total,
      docs: v.docs,
      primerPeriodo: v.min,
      ultimoPeriodo: v.max,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface PuntoMes {
  periodo: string;
  monto: number;
}

/** Serie mensual CONTINUA (rellena con 0 los meses sin movimiento) del `rut` en [desde, hasta]. */
export function serieMensual(
  docs: DocConVencimiento[],
  rut: string,
  desde: string,
  hasta: string,
): PuntoMes[] {
  const byPer = new Map<string, number>();
  for (const d of docs) {
    if (normalizeRut(d.rut) !== rut) continue; // `rut` viene normalizado del agregado
    const per = periodoDe(d.fecha);
    if (!per) continue;
    byPer.set(per, (byPer.get(per) ?? 0) + montoFirmado(d));
  }
  const out: PuntoMes[] = [];
  let p = desde;
  for (let i = 0; i < 400 && comparePeriod(p, hasta) <= 0; i++) {
    out.push({ periodo: p, monto: byPer.get(p) ?? 0 });
    p = addMonths(p, 1);
  }
  return out;
}

/** Descarta el mes EN CURSO (el último de una serie continua que llega hasta hoy): su valor es
 *  PARCIAL (medio mes) y no se compara con meses completos — distorsiona el año-contra-año, la
 *  estacionalidad y el "a recuperar". Espeja el criterio de `separarMesEnCurso` de la Tendencia. */
export function sinMesEnCurso(serie: PuntoMes[]): PuntoMes[] {
  return serie.length > 0 ? serie.slice(0, -1) : serie;
}

export interface TendenciaAnual {
  ultimos12: number;
  previos12: number;
  /** Variación % de los últimos 12m vs los 12 previos; `null` si no hay base. */
  deltaPct: number | null;
}

/** Año contra año: suma de los últimos 12 meses vs los 12 anteriores. `null` si no hay 24 meses O
 *  si los 12 previos no tienen actividad real (la relación no existía) — sin dos años con actividad
 *  no hay comparación honesta (evita mostrar "vs los 12 previos $0" para un cliente nuevo). */
export function tendenciaAnual(serie: PuntoMes[]): TendenciaAnual | null {
  if (serie.length < 24) return null;
  const n = serie.length;
  const suma = (arr: PuntoMes[]) => arr.reduce((s, p) => s + p.monto, 0);
  const ultimos12 = suma(serie.slice(n - 12));
  const previos12 = suma(serie.slice(n - 24, n - 12));
  if (previos12 <= 0) return null; // sin actividad hace un año → no se compara
  const deltaPct = ((ultimos12 - previos12) / Math.abs(previos12)) * 100;
  return { ultimos12, previos12, deltaPct };
}

export interface MesEstacional {
  /** 1..12 */
  mes: number;
  promedio: number;
}

/** Estacionalidad: promedio de venta/compra por mes de calendario (1..12) sobre los años de la serie.
 *  Responde "¿en qué meses te compra/le compras más?". */
export function estacionalidad(serie: PuntoMes[]): MesEstacional[] {
  const acc = new Map<number, { sum: number; n: number }>();
  for (const p of serie) {
    const mes = Number(p.periodo.slice(5, 7));
    if (!mes) continue;
    const cur = acc.get(mes) ?? { sum: 0, n: 0 };
    cur.sum += p.monto;
    cur.n += 1;
    acc.set(mes, cur);
  }
  const out: MesEstacional[] = [];
  for (let m = 1; m <= 12; m++) {
    const c = acc.get(m);
    out.push({ mes: m, promedio: c && c.n ? c.sum / c.n : 0 });
  }
  return out;
}

/** % que representa esta contraparte del total (concentración). `null` si no hay total. */
export function concentracionPct(total: number, totalGlobal: number): number | null {
  return totalGlobal > 0 ? (total / totalGlobal) * 100 : null;
}
