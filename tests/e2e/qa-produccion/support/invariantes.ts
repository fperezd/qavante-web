/* Invariantes financieros PUROS sobre respuestas de la API. NO es un spec.

   Los usan los specs de `qa-produccion/` (hallazgos B01–B28) y `data-consistency.real.spec.ts`.
   Ninguno conoce montos ni RUT concretos de Tooxs: buscan el PATRÓN del hallazgo. */

import { clp, glosaNormalizada, normalizarRut, num, numOrNull, rutsEnTexto } from "./finanzas";
import type { BankAccount, BankMovement, CollectionForecast, ReviewItem, WorkInbox } from "./tipos";

/* ── Saldo ─────────────────────────────────────────────────────────────────── */

export interface SaldoBanco {
  /** Σ saldo de cuentas activas (no tarjetas) en la moneda pedida. `null` si ninguna trae saldo. */
  total: number | null;
  cuentas: number;
  conSaldo: number;
  ultimaFecha: string | null;
}

export function saldoBanco(cuentas: BankAccount[], moneda = "CLP"): SaldoBanco {
  const vivas = cuentas.filter(
    (c) =>
      c.active &&
      c.account_type !== "credit_card" &&
      (c.currency_code || "").toUpperCase() === moneda,
  );
  let total = 0;
  let conSaldo = 0;
  let ultimaFecha: string | null = null;
  for (const c of vivas) {
    const b = numOrNull(c.balance);
    if (b === null) continue;
    total += b;
    conSaldo += 1;
    const f = c.balance_as_of ?? null;
    if (f && (!ultimaFecha || f > ultimaFecha)) ultimaFecha = f;
  }
  return { total: conSaldo ? total : null, cuentas: vivas.length, conSaldo, ultimaFecha };
}

/* ── Conciliación ──────────────────────────────────────────────────────────── */

export interface Hallazgo {
  movimiento: string;
  detalle: string;
}

function docs(item: ReviewItem) {
  return item.suggestion?.documents ?? [];
}

/** B03: la glosa trae un RUT y la propuesta usa un documento con OTRO RUT. */
export function rutContradicho(items: ReviewItem[]): Hallazgo[] {
  const out: Hallazgo[] = [];
  for (const it of items) {
    const enGlosa = rutsEnTexto(it.description);
    if (enGlosa.length === 0) continue;
    for (const d of docs(it)) {
      const r = normalizarRut(d.rut);
      if (r && !enGlosa.includes(r)) {
        out.push({
          movimiento: it.movement_id,
          detalle: `${it.date} ${clp(Math.abs(num(it.amount)), it.currency_code ?? "CLP")} "${it.description ?? ""}" (RUT glosa ${enGlosa.join(", ")}) propuesto contra ${d.folio ? `folio ${d.folio}` : d.document_id} de ${d.name ?? "?"} (RUT ${d.rut})`,
        });
      }
    }
  }
  return out;
}

/** B07: calce exacto (RUT de la glosa = RUT del documento y monto al peso) que sigue en revisión. */
export function calcesExactosEnRevision(items: ReviewItem[]): Hallazgo[] {
  const out: Hallazgo[] = [];
  for (const it of items) {
    const ds = docs(it);
    if (ds.length !== 1) continue;
    const d = ds[0]!;
    const r = normalizarRut(d.rut);
    const enGlosa = rutsEnTexto(it.description);
    const montoMov = Math.abs(num(it.amount));
    const montoDoc = Math.abs(num(d.amount));
    if (r && enGlosa.includes(r) && montoDoc > 0 && Math.abs(montoMov - montoDoc) < 1) {
      out.push({
        movimiento: it.movement_id,
        detalle: `${it.date} ${clp(montoMov, it.currency_code ?? "CLP")} = ${d.folio ? `folio ${d.folio}` : d.document_id} de ${d.name ?? "?"} (RUT ${d.rut}); puntaje ${it.suggestion.score ?? "?"}`,
      });
    }
  }
  return out;
}

/** B08: dos o más movimientos propuestos por separado contra el MISMO documento cuya suma lo calza. */
export function pagosFraccionadosSinCombinar(items: ReviewItem[]): Hallazgo[] {
  const porDoc = new Map<string, ReviewItem[]>();
  for (const it of items) {
    const id =
      it.suggestion?.document_id ?? (docs(it).length === 1 ? docs(it)[0]!.document_id : null);
    if (!id) continue;
    porDoc.set(id, [...(porDoc.get(id) ?? []), it]);
  }
  const out: Hallazgo[] = [];
  for (const [docId, grupo] of porDoc) {
    if (grupo.length < 2) continue;
    const d = docs(grupo[0]!).find((x) => x.document_id === docId) ?? docs(grupo[0]!)[0];
    const montoDoc = Math.abs(num(d?.amount));
    const suma = grupo.reduce((a, it) => a + Math.abs(num(it.amount)), 0);
    if (montoDoc > 0 && Math.abs(suma - montoDoc) < 1) {
      out.push({
        movimiento: grupo.map((g) => g.movement_id).join(" + "),
        detalle: `${grupo.map((g) => clp(Math.abs(num(g.amount)))).join(" + ")} = ${clp(suma)} calza con ${d?.folio ? `folio ${d.folio}` : docId} (${clp(montoDoc)}), pero se proponen como ${grupo.length} parciales separados`,
      });
    }
  }
  return out;
}

/* ── Colas ─────────────────────────────────────────────────────────────────── */

/** B06: el mismo movimiento en Conciliar y en Clasificar. */
export function enDosColas(review: ReviewItem[], sinClasificar: BankMovement[]): Hallazgo[] {
  const ids = new Set(sinClasificar.map((m) => m.id));
  return review
    .filter((it) => ids.has(it.movement_id))
    .map((it) => ({
      movimiento: it.movement_id,
      detalle: `${it.date} ${clp(Math.abs(num(it.amount)), it.currency_code ?? "CLP")} "${it.description ?? ""}" está en Conciliar y en Clasificar`,
    }));
}

/** B06 (vía work-inbox): un id en más de una cola. */
export function repetidosEntreColas(inbox: WorkInbox): Hallazgo[] {
  const colasPorId = new Map<string, string[]>();
  for (const q of inbox.queues ?? []) {
    for (const it of q.items ?? []) {
      colasPorId.set(it.id, [...(colasPorId.get(it.id) ?? []), q.kind]);
    }
  }
  return [...colasPorId]
    .filter(([, colas]) => new Set(colas).size > 1)
    .map(([id, colas]) => ({ movimiento: id, detalle: `aparece en ${colas.join(" y ")}` }));
}

/** B05: movimientos de cuentas que no figuran entre las activas, y sus duplicados en otra cuenta. */
export function huerfanosYDuplicados(
  movs: BankMovement[],
  cuentas: BankAccount[],
): { huerfanos: Hallazgo[]; duplicados: Hallazgo[] } {
  const activas = new Set(cuentas.filter((c) => c.active).map((c) => c.id));
  const huerfanos = movs
    .filter((m) => !activas.has(m.bank_account_id))
    .map((m) => ({
      movimiento: m.id,
      detalle: `${m.date} ${m.direction} ${clp(Math.abs(num(m.amount)), m.currency_code ?? "CLP")} "${m.description}" en la cuenta ${m.bank_account_id}, que no está entre las cuentas activas`,
    }));
  const porOperacion = new Map<string, BankMovement[]>();
  for (const m of movs) {
    const k = [
      m.date,
      m.direction,
      Math.abs(num(m.amount)).toFixed(2),
      glosaNormalizada(m.description),
    ].join("|");
    porOperacion.set(k, [...(porOperacion.get(k) ?? []), m]);
  }
  const duplicados: Hallazgo[] = [];
  for (const grupo of porOperacion.values()) {
    const cuentasDistintas = new Set(grupo.map((m) => m.bank_account_id));
    if (cuentasDistintas.size > 1) {
      const m = grupo[0]!;
      duplicados.push({
        movimiento: grupo.map((g) => g.id).join(" / "),
        detalle: `${m.date} ${clp(Math.abs(num(m.amount)), m.currency_code ?? "CLP")} "${m.description}" está en ${cuentasDistintas.size} cuentas (${[...cuentasDistintas].join(", ")})`,
      });
    }
  }
  return { huerfanos, duplicados };
}

/* ── Montos por moneda y dirección ─────────────────────────────────────────── */

export interface PorDireccion {
  entradas: number;
  salidas: number;
  nEntradas: number;
  nSalidas: number;
}

/** Suma por dirección en UNA moneda (la de la cuenta si el movimiento no la trae). */
export function porDireccion(
  movs: {
    amount: string;
    direction?: string | null;
    currency_code?: string | null;
    bank_account_id?: string;
  }[],
  moneda: string,
  monedaDeCuenta: Map<string, string> = new Map(),
): PorDireccion {
  const out: PorDireccion = { entradas: 0, salidas: 0, nEntradas: 0, nSalidas: 0 };
  for (const m of movs) {
    const cur = (
      m.currency_code ||
      monedaDeCuenta.get(m.bank_account_id ?? "") ||
      ""
    ).toUpperCase();
    if (cur !== moneda) continue;
    const a = num(m.amount);
    const credito = m.direction ? m.direction === "credit" : a > 0;
    if (credito) {
      out.entradas += Math.abs(a);
      out.nEntradas += 1;
    } else {
      out.salidas += Math.abs(a);
      out.nSalidas += 1;
    }
  }
  return out;
}

export function monedaPorCuenta(cuentas: BankAccount[]): Map<string, string> {
  return new Map(cuentas.map((c) => [c.id, (c.currency_code || "").toUpperCase()]));
}

/* ── Cobranza ──────────────────────────────────────────────────────────────── */

export interface Entra14 {
  /** Como lo calcula Caja hoy: sólo buckets completos dentro de 0–14. */
  comoCaja: number;
  /** Buckets que EMPIEZAN dentro de la ventana (incluye los que la cruzan). */
  conCruzados: number;
  bucketsCruzados: string[];
  totalNominal: number | null;
}

export function entra14(f: CollectionForecast, ventana = 14): Entra14 {
  let comoCaja = 0;
  let conCruzados = 0;
  const bucketsCruzados: string[] = [];
  for (const b of f.buckets ?? []) {
    const n = num(b.nominal);
    if (b.days_from >= 0 && b.days_to <= ventana) comoCaja += n;
    if (b.days_from >= 0 && b.days_from <= ventana) {
      conCruzados += n;
      if (b.days_to > ventana)
        bucketsCruzados.push(`${b.label} (${b.days_from}–${b.days_to} días, ${clp(n)})`);
    }
  }
  return { comoCaja, conCruzados, bucketsCruzados, totalNominal: numOrNull(f.total_nominal) };
}

/** Descomposición del forecast: vencido + buckets + más allá + sin vencimiento. */
export function descomposicionForecast(f: CollectionForecast): number {
  return (
    num(f.overdue?.nominal) +
    (f.buckets ?? []).reduce((a, b) => a + num(b.nominal), 0) +
    num(f.beyond_horizon?.nominal) +
    num(f.sin_vencimiento?.nominal)
  );
}

export function listar(h: Hallazgo[], max = 15): string {
  const lineas = h.slice(0, max).map((x) => `  · ${x.detalle} [${x.movimiento}]`);
  if (h.length > max) lineas.push(`  … y ${h.length - max} más (ver api.json)`);
  return lineas.join("\n");
}
