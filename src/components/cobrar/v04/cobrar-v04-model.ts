import { exportTable, type ExportTable } from "@/lib/export/table";
/* V04 · Cobrar — el modelo PURO de la vista (rediseño Fase 2, issue #69).
 *
 * Contesta UNA pregunta: "¿quién me debe?".
 *
 * Sin React a propósito, como `hoy-model.ts`, `caja-v02-model.ts` y `banco-v03-model.ts`: cada
 * tarjeta, cada pill y cada conteo de esta pantalla es una afirmación sobre plata que se fija en un
 * test sin montar un DOM.
 *
 * FUENTE ÚNICA (verificada contra `src/lib/api/types.ts`, generado del OpenAPI vivo, y contra
 * `receivables_repo.accounts_receivable` en `qavante-api`, 2026-08-30):
 *   · `GET /api/treasury/accounts-receivable` — total, vencido, aging, deudores y documentos
 *     vencidos. Es la MISMA función del backend que alimenta `overdue_collections` del summary, o
 *     sea el indicador "Te deben" de V01 (Ley 1: un concepto, un número, un endpoint).
 *   · las preferencias de UI (`cobranza_gestionado`, el "marcar gestionado" de Cobrar v2) para la
 *     última gestión por cliente y el chip del crumb.
 *
 * LOS TRES ESTADOS DEL VENCIDO, que este módulo nunca confunde (hallazgo H6, qavante-api#107/#123):
 *   · un número → se muestra (incluido el `0` verificado: "al día");
 *   · `null`    → NO SE SABE. El SII no entrega vencimientos hasta el XML del DTE; en producción
 *                 HOY el tenant principal recibe `overdue: null`. Nunca se pinta como $0 ni como
 *                 "0% vencido": la tarjeta dice "sin dato" con el motivo del backend.
 *
 * LO QUE ESTE MÓDULO NO HACE, dicho acá y no sólo en el PR:
 *   · No deriva vencimientos "emisión + término" como hace Cobrar v2 con el maestro RCV: ese
 *     vencido derivado con un término por defecto es un dato plausible que V01 no muestra, y
 *     mostrarlo acá haría que "Te deben" (V01) y "Vencido" (V04) dijeran dos cosas (Ley 1).
 *   · No excluye cedidas por su cuenta: el contrato no expone `ceded`. Las excluye el backend
 *     (`ceded_at IS NULL`, ADR-0084) en total, aging, deudores y documentos — INV-AR-001 se cumple
 *     aguas arriba y el front lo declara en el ⓘ, no lo recalcula.
 *   · No separa monedas: el endpoint no trae `currency_code` y suma `outstanding_amount` crudo. Se
 *     declara (INV-FX-001) en vez de fingir que todo es CLP verificado.
 *   · No reconstruye identidades de cobro: los envíos usan exclusivamente `receivable_ids` que
 *     publica el backend junto al deudor. Si faltan, no hay envío ni un default plausible (#311).
 *   · No infiere la CERTEZA de un vencimiento: `due_date_certainty` y `due_date_note` de cada
 *     `overdue_documents[]` son server-owned (ver `rediseno/certeza-vencimiento.ts`). Sólo los
 *     documentos `confirmed` alimentan los días de mora de la fila; los `estimated`/`unconfirmed`
 *     se listan con su pill y su nota tal cual, y un documento SIN el campo no se asume
 *     confirmado. `estimated_due_date_count` se publica junto a "Vencido · bruto" como conteo
 *     del servidor, fuera de la mora. */

import type { AccountsReceivableResponse, OverdueDocument, TopDebtor } from "@/lib/api/cobranza";
import { parseAmount, parseAmountOrNull } from "@/lib/formatters/amount";
import { formatClp } from "@/lib/formatters/clp";
import { formatPct } from "@/lib/formatters/pct";
import { formatDateLong, formatDateShort, formatRelative } from "@/lib/formatters/date";
import { formatRut } from "@/lib/formatters/rut";
import { csv, csvCell } from "@/lib/export/csv";
import { concentracionPct } from "@/components/gestion/v2/contraparte-360-model";
import {
  explicarVencidoSinDato,
  rutKey,
  sortByUrgency,
  vencidoDeDeudor,
  type VencidoSinDato,
} from "../cobranza-format";
import { mailtoHref, reminderText, waHref, type GestionadoMap } from "../v2/cobrar-v2-map";
import {
  CERTEZA_CSV,
  certezaDe,
  conteoEstimadasDe,
  esConfirmada,
  type CertezaPresentada,
} from "@/components/rediseno/certeza-vencimiento";

/** Spec §V04: la pill es `bad` recién pasados los 60 días de mora. */
export const UMBRAL_GRAVE_DIAS = 60;
/** "3 clientes concentran…" — el tamaño del lote de la spec. */
export const LOTE_CLIENTES = 3;
/** Ventana de arrepentimiento del lote (Ley 4): segundos visibles y cancelables. */
export const LOTE_SEGUNDOS = 5;
/** Asunto del `mailto:` — el mismo que usa Cobrar v2 (plantilla actual). */
export const ASUNTO_RECORDATORIO = "Cobranza pendiente";

/* ── (2) Las cinco tarjetas de aging ─────────────────────────────────────────── */

export type TramoV04 = "vigente" | "d1_30" | "d31_60" | "d61_plus" | "vencido";

export interface TarjetaAgingV04 {
  key: TramoV04;
  label: string;
  /** Monto del tramo. `null` = el backend NO pudo computarlo. Nunca 0 por defecto. */
  monto: number | null;
  /** % del total por cobrar (bruto). `null` cuando el monto no se conoce. */
  pct: number | null;
  /** El monto es un PISO (contrato: "vigente" se publica siempre, como piso de lo no vencido con
   *  fecha conocida) y no el tramo completo, porque la mora es desconocida. Se dice "al menos". */
  piso: boolean;
}

const LABEL_TRAMO: Record<TramoV04, string> = {
  vigente: "Vigente",
  d1_30: "1–30 días",
  d31_60: "31–60 días",
  d61_plus: "+61 días",
  vencido: "Vencido · bruto",
};

function pctDelTotal(monto: number | null, total: number): number | null {
  if (monto == null) return null;
  if (total > 0) return (monto / total) * 100;
  /* Total en cero con monto conocido: reparto 0, no "sin dato" (cero verificado). */
  return 0;
}

/** Las 5 tarjetas de la spec (Vigente / 1–30 / 31–60 / +61 / Vencido · bruto) con % del total.
 *
 *  · `+61` = `d61_90` + `d90_plus`, y es `null` si CUALQUIERA de los dos no se conoce: una suma con
 *    un sumando desconocido es desconocida (misma regla dura que `agingBreakdown`, F1).
 *  · `Vencido` es `overdue` del contrato tal cual —NO la suma de los tramos— y su % es
 *    `overdue_pct` del contrato: es la misma definición que alimenta "Te deben" en V01 (Ley 1).
 *    Si el backend manda `overdue` sin `overdue_pct`, se calcula sobre `total`; con `overdue`
 *    en `null` el % también queda `null` (nunca "0% vencido").
 *  · El denominador de los tramos es el total por cobrar (bruto) del footer: los documentos sin
 *    fecha (`undated_amount`) están en el total y en ningún tramo, así que los % no suman 100 y
 *    eso es correcto — la diferencia es exactamente lo que no se sabe.
 *  · `Vigente` con la mora desconocida es un PISO ("al menos"), no el tramo. Y un piso de $0 no
 *    informa nada: con todos los documentos sin fecha, "Vigente $0" diría "nada vigente" sobre lo
 *    que no se sabe — ahí también es "sin dato". */
export function tarjetasAging(
  ar: AccountsReceivableResponse | null | undefined,
): TarjetaAgingV04[] {
  const total = ar ? parseAmount(ar.total) : 0;
  const vigenteCrudo = ar ? parseAmountOrNull(ar.aging.current) : null;
  const d1_30 = ar ? parseAmountOrNull(ar.aging.d1_30) : null;
  const d31_60 = ar ? parseAmountOrNull(ar.aging.d31_60) : null;
  const d61_90 = ar ? parseAmountOrNull(ar.aging.d61_90) : null;
  const d90_plus = ar ? parseAmountOrNull(ar.aging.d90_plus) : null;
  const d61_plus = d61_90 == null || d90_plus == null ? null : d61_90 + d90_plus;
  const moraDesconocida = d1_30 == null || d31_60 == null || d61_plus == null;
  const vigente =
    moraDesconocida && vigenteCrudo != null && vigenteCrudo <= 0 ? null : vigenteCrudo;
  const vencido = ar ? parseAmountOrNull(ar.overdue) : null;
  const vencidoPctApi = ar ? parseAmountOrNull(ar.overdue_pct) : null;
  const vencidoPct = vencido == null ? null : (vencidoPctApi ?? pctDelTotal(vencido, total));

  const tramo = (key: TramoV04, monto: number | null, piso = false): TarjetaAgingV04 => ({
    key,
    label: LABEL_TRAMO[key],
    monto,
    pct: pctDelTotal(monto, total),
    piso: piso && monto != null,
  });
  return [
    tramo("vigente", vigente, moraDesconocida),
    tramo("d1_30", d1_30),
    tramo("d31_60", d31_60),
    tramo("d61_plus", d61_plus),
    { key: "vencido", label: LABEL_TRAMO.vencido, monto: vencido, pct: vencidoPct, piso: false },
  ];
}

/** Por qué no se puede decir cuánto está vencido (motivo + acción, del contrato #123). */
export function motivoSinVencido(
  ar: AccountsReceivableResponse | null | undefined,
): VencidoSinDato {
  return explicarVencidoSinDato(ar ?? {});
}

/* ── (5) Tabla de clientes ───────────────────────────────────────────────────── */

export type TonoAntiguedad = "bad" | "warn" | "ok" | "mut";

export interface AntiguedadV04 {
  tono: TonoAntiguedad;
  texto: string;
}

export interface ClienteV04 {
  /** Clave estable de la fila: el RUT normalizado o, sin RUT, el nombre. */
  key: string;
  /** Razón social completa — nunca se trunca (Ley 7). */
  nombre: string;
  rut: string | null;
  /** RUT formateado para mostrar, o "RUT no informado". */
  rutLabel: string;
  /** UUIDs trazables de documentos vivos/no cedidos que el backend atribuye a este deudor.
   * Nunca se derivan desde los campos visibles: se mandan tal cual al lote real (#311). */
  receivableIds: string[];
  /** Saldo por cobrar de este cliente (CLP según el registro). */
  saldo: number;
  /** Vencido de este cliente. `null` = el contrato no pudo computarlo (#124): NO es 0. */
  vencido: number | null;
  /** Días de mora del documento MÁS vencido de este cliente (de `overdue_documents`). `null` si
   *  el registro no lista documentos vencidos suyos. */
  dias: number | null;
  /** Documentos vencidos listados por el registro para este cliente. */
  docsVencidos: number;
  /** Qué parte del total por cobrar es este cliente (%). `null` sin total. */
  pctDelTotal: number | null;
  /** ISO `YYYY-MM-DD` de la última vez que se marcó gestionado, o `null`. */
  ultimaGestion: string | null;
  /** Documentos vencidos de este cliente cuya fecha NO está confirmada, con la certeza y la nota
   *  que publicó el servidor. Vacío = todos confirmados (o ninguno listado). */
  certezas: CertezaDocV04[];
  antiguedad: AntiguedadV04;
  /** El `.sub` de la spec: vencido + días + última gestión (+ concentración si pesa). */
  sub: string;
}

export interface CertezaDocV04 {
  /** "Factura 462", tal cual lo publica el registro. */
  documento: string;
  certeza: Exclude<CertezaPresentada, "confirmed">;
  /** `due_date_note` del documento, o `null` si no vino. Nunca se inventa. */
  nota: string | null;
}

interface DocsDeCliente {
  /** Días del documento CONFIRMADO más vencido. `null` si ninguno confirmado. */
  maxDias: number | null;
  /** Todos los documentos vencidos listados para el cliente, con cualquier certeza. */
  n: number;
  certezas: CertezaDocV04[];
}

/** Agrupa los documentos vencidos por RUT (normalizado): días del más vencido + conteo.
 *
 *  Sólo un documento `confirmed` mueve `maxDias`: una fecha estimada o sin confirmar (o sin el
 *  campo) no sustenta mora en el cliente, así que no puede fijar "hace N días" ni el rojo. Esos
 *  documentos quedan en `certezas`, con su nota server-owned, para mostrarse como lo que son. */
export function docsVencidosPorRut(
  docs: ReadonlyArray<OverdueDocument> | null | undefined,
): Map<string, DocsDeCliente> {
  const out = new Map<string, DocsDeCliente>();
  for (const d of docs ?? []) {
    const k = rutKey(d.client_rut);
    if (!k) continue;
    const cur = out.get(k) ?? { maxDias: null, n: 0, certezas: [] };
    cur.n += 1;
    const { certeza, nota } = certezaDe(d);
    if (esConfirmada(certeza)) {
      if (cur.maxDias == null || d.days_overdue > cur.maxDias) cur.maxDias = d.days_overdue;
    } else {
      cur.certezas.push({ documento: d.document, certeza, nota });
    }
    out.set(k, cur);
  }
  return out;
}

/** `estimated_due_date_count` del servidor. `null` si no vino: no se asume 0. */
export function estimadasDe(ar: AccountsReceivableResponse | null | undefined): number | null {
  return conteoEstimadasDe(ar?.estimated_due_date_count);
}

/** La pill de antigüedad (spec §V04: bad >60d, warn 1–60d, ok al día). El rojo es UNO por pantalla
 *  (Ley 2): sólo el cliente más grave lo lleva; los demás con +60 días van en ámbar con los mismos
 *  días escritos. El "no sé" es gris: sin vencimiento conocido no hay veredicto. */
export function antiguedadDe(
  c: { vencido: number | null; dias: number | null },
  esElMasGrave: boolean,
): AntiguedadV04 {
  if (c.vencido == null) return { tono: "mut", texto: "Sin vencimiento conocido" };
  if (c.vencido <= 0) return { tono: "ok", texto: "Al día" };
  if (c.dias == null) return { tono: "warn", texto: "Vencido" };
  const texto = `${c.dias} ${c.dias === 1 ? "día" : "días"}`;
  if (c.dias > UMBRAL_GRAVE_DIAS && esElMasGrave) return { tono: "bad", texto };
  return { tono: "warn", texto };
}

/** El cliente más grave: el de MÁS días de mora por sobre el umbral; a igual días, el de mayor
 *  vencido. `null` si nadie pasa los 60 días — entonces la pantalla no tiene rojo. */
export function clienteMasGrave<
  T extends { key: string; vencido: number | null; dias: number | null },
>(clientes: ReadonlyArray<T>): T | null {
  let peor: T | null = null;
  for (const c of clientes) {
    if (c.vencido == null || c.vencido <= 0 || c.dias == null || c.dias <= UMBRAL_GRAVE_DIAS)
      continue;
    if (
      peor == null ||
      c.dias > peor.dias! ||
      (c.dias === peor.dias && c.vencido > (peor.vencido ?? 0))
    )
      peor = c;
  }
  return peor;
}

function subDe(
  c: {
    vencido: number | null;
    dias: number | null;
    ultimaGestion: string | null;
    pctDelTotal: number | null;
  },
  { includeConcentracion = true }: { includeConcentracion?: boolean } = {},
): string {
  const partes: string[] = [];
  if (c.vencido == null) partes.push("vencido: no se sabe");
  else if (c.vencido > 0) {
    partes.push(
      c.dias == null
        ? `vencido ${formatClp(c.vencido)}`
        : `vencido ${formatClp(c.vencido)} hace ${c.dias} ${c.dias === 1 ? "día" : "días"}`,
    );
  } else if (c.vencido === 0) partes.push("nada vencido");
  else partes.push(`vencido ${formatClp(c.vencido)} · notas de crédito por sobre lo vencido`);
  partes.push(
    c.ultimaGestion ? `gestionado ${formatDateShort(c.ultimaGestion)}` : "sin gestión registrada",
  );
  if (includeConcentracion && c.pctDelTotal != null && c.pctDelTotal >= 10)
    partes.push(`${formatPct(c.pctDelTotal)} del total`);
  return partes.join(" · ");
}

/** Orden de presentación de la tabla. `source` conserva el orden publicado por el registro: es
 * evidencia, no una nueva recomendación construida en el cliente. */
export type ClientesV04Order = "priority" | "source";

export interface ClientesV04Options {
  order?: ClientesV04Order;
  /** El Brief ya evalúa la decisión: no crear severidad ni concentración local en la cartera. */
  includeDecisionSignals?: boolean;
}

/** Las filas de la tabla. Por defecto conserva el orden de PRIORIDAD heredado (vencido conocido de
 * mayor a menor, luego los "no se sabe", al final los al día; desempata el saldo). Cuando el Brief
 * canónico está activo, la vista pide `source` y no vuelve a crear un ranking local. */
export function clientesV04(
  ar: AccountsReceivableResponse | null | undefined,
  gestionado: GestionadoMap,
  options: ClientesV04Options = {},
): ClienteV04[] {
  if (!ar) return [];
  const total = parseAmount(ar.total);
  const includeDecisionSignals = options.includeDecisionSignals ?? true;
  const docs = docsVencidosPorRut(ar.overdue_documents);
  const debtors =
    options.order === "source" ? (ar.top_debtors ?? []) : sortByUrgency(ar.top_debtors ?? []);
  const base = debtors.map((d: TopDebtor) => {
    const k = rutKey(d.rut);
    const vencido = vencidoDeDeudor(d);
    const suyos = k ? docs.get(k) : undefined;
    return {
      key: k || `nombre:${d.name}`,
      nombre: d.name,
      rut: d.rut ?? null,
      rutLabel: d.rut ? formatRut(d.rut) : "RUT no informado",
      receivableIds: d.receivable_ids ?? [],
      saldo: parseAmount(d.total),
      vencido,
      dias: suyos?.maxDias ?? null,
      docsVencidos: suyos?.n ?? 0,
      certezas: suyos?.certezas ?? [],
      pctDelTotal: includeDecisionSignals ? concentracionPct(parseAmount(d.total), total) : null,
      ultimaGestion: k && typeof gestionado[k] === "string" ? gestionado[k]! : null,
    };
  });
  const grave = includeDecisionSignals ? clienteMasGrave(base) : null;
  return base.map((c) => ({
    ...c,
    antiguedad: includeDecisionSignals
      ? antiguedadDe(c, grave != null && grave.key === c.key)
      : antiguedadEvidencia(c),
    sub: subDe(c, { includeConcentracion: includeDecisionSignals }),
  }));
}

/** La tabla de evidencia conserva el estado publicado sin convertirlo en ranking o alerta local. */
function antiguedadEvidencia(c: { vencido: number | null }): AntiguedadV04 {
  if (c.vencido == null) return { tono: "mut", texto: "Sin vencimiento conocido" };
  if (c.vencido > 0) return { tono: "mut", texto: "Vencido" };
  return { tono: "mut", texto: "Al día" };
}

/* ── (4) Filtros con conteo + búsqueda ───────────────────────────────────────── */

export type FiltroV04 = "prioridad" | "vencido" | "mas60" | "sin_vencimiento" | "al_dia";

export const FILTROS_V04: ReadonlyArray<{ id: FiltroV04; label: string }> = [
  { id: "prioridad", label: "Prioridad" },
  { id: "vencido", label: "Vencido" },
  { id: "mas60", label: `+${UMBRAL_GRAVE_DIAS} días` },
  { id: "sin_vencimiento", label: "Sin vencimiento conocido" },
  { id: "al_dia", label: "Al día" },
];

function pasaFiltro(c: ClienteV04, filtro: FiltroV04): boolean {
  switch (filtro) {
    case "vencido":
      return c.vencido != null && c.vencido > 0;
    case "mas60":
      return c.vencido != null && c.vencido > 0 && c.dias != null && c.dias > UMBRAL_GRAVE_DIAS;
    case "sin_vencimiento":
      return c.vencido == null;
    case "al_dia":
      return c.vencido != null && c.vencido <= 0;
    default:
      return true;
  }
}

/** ¿El cliente coincide con la búsqueda? Por nombre (sin distinguir mayúsculas) o por RUT (con o
 *  sin puntos y guion). Vacío → todos. */
export function coincideConsulta(
  c: { nombre: string; rut: string | null },
  consulta: string,
): boolean {
  const q = consulta.trim().toLowerCase();
  if (!q) return true;
  if (c.nombre.toLowerCase().includes(q)) return true;
  const qRut = q.replace(/[.\-\s]/g, "");
  if (!qRut || !c.rut) return false;
  return c.rut
    .replace(/[.\-\s]/g, "")
    .toLowerCase()
    .includes(qRut);
}

export function filtrarClientes(
  clientes: ReadonlyArray<ClienteV04>,
  filtro: FiltroV04,
  consulta = "",
): ClienteV04[] {
  return clientes.filter((c) => coincideConsulta(c, consulta) && pasaFiltro(c, filtro));
}

/** Los conteos de los chips (spec §1.3: "SIEMPRE con conteo"), sobre la búsqueda vigente. */
export function contarClientes(
  clientes: ReadonlyArray<ClienteV04>,
  consulta = "",
): Record<FiltroV04, number> {
  const out: Record<FiltroV04, number> = {
    prioridad: 0,
    vencido: 0,
    mas60: 0,
    sin_vencimiento: 0,
    al_dia: 0,
  };
  for (const c of clientes) {
    if (!coincideConsulta(c, consulta)) continue;
    for (const f of FILTROS_V04) if (pasaFiltro(c, f.id)) out[f.id] += 1;
  }
  return out;
}

/* ── (3) Banner de concentración ─────────────────────────────────────────────── */

export type ConcentracionV04 =
  | {
      /** Se sabe qué está vencido: los N que más vencido concentran. */
      kind: "vencido";
      clientes: ClienteV04[];
      monto: number;
      /** % del vencido total (bruto) que cubren. `null` sin vencido total. */
      pct: number | null;
    }
  | {
      /** NO se sabe qué está vencido: se concentra por saldo y se dice. */
      kind: "saldo";
      clientes: ClienteV04[];
      monto: number;
      /** % del total por cobrar que cubren. */
      pct: number | null;
      motivo: string;
    }
  | null;

/** "3 clientes concentran $X del vencido". `null` cuando no hay a quién concentrar: sin clientes,
 *  o con vencido conocido y en cero (al día: no se inventa urgencia). Con vencido desconocido NO se
 *  calla: concentra por saldo y declara que no sabe cuánto de eso está vencido (mismo criterio que el
 *  modo "concentración" de Cobrar v2). Sólo suma los N mayores — nunca "los demás". */
export function concentracion(
  clientes: ReadonlyArray<ClienteV04>,
  ar: AccountsReceivableResponse | null | undefined,
  n = LOTE_CLIENTES,
): ConcentracionV04 {
  if (!ar || clientes.length === 0) return null;
  const vencidoTotal = parseAmountOrNull(ar.overdue);
  if (vencidoTotal != null) {
    if (vencidoTotal <= 0) return null;
    const top = clientes
      .filter((c) => c.vencido != null && c.vencido > 0)
      .sort((a, b) => b.vencido! - a.vencido!)
      .slice(0, n);
    if (top.length === 0) return null;
    const monto = top.reduce((s, c) => s + c.vencido!, 0);
    return { kind: "vencido", clientes: top, monto, pct: concentracionPct(monto, vencidoTotal) };
  }
  const top = [...clientes].sort((a, b) => b.saldo - a.saldo).slice(0, n);
  const monto = top.reduce((s, c) => s + c.saldo, 0);
  return {
    kind: "saldo",
    clientes: top,
    monto,
    pct: concentracionPct(monto, parseAmount(ar.total)),
    motivo: motivoSinVencido(ar).motivo,
  };
}

/* ── (1) Crumb: el estado de gestión como chip gris ──────────────────────────── */

export interface CrumbV04 {
  /** Texto del chip. Siempre gris (Ley 2: nunca un banner verde de celebración). */
  chip: string;
  gestionados: number;
  /** ISO de la gestión más reciente, o `null`. */
  ultima: string | null;
}

export function crumbGestion(clientes: ReadonlyArray<ClienteV04>, hoy: Date): CrumbV04 {
  const conGestion = clientes.filter((c) => c.ultimaGestion != null);
  const ultima = conGestion.reduce<string | null>(
    (max, c) => (max == null || c.ultimaGestion! > max ? c.ultimaGestion! : max),
    null,
  );
  const n = conGestion.length;
  if (n === 0 || ultima == null) {
    return { chip: "Sin gestiones registradas", gestionados: 0, ultima: null };
  }
  const cuando = formatRelative(ultima, hoy);
  const chip =
    n === clientes.length
      ? `Gestionaste a ${n === 1 ? "tu único cliente" : `los ${n} clientes`} · última ${cuando}`
      : `Gestionaste a ${n} de ${clientes.length} clientes · última ${cuando}`;
  return { chip, gestionados: n, ultima };
}

/* ── (6) Footer: total por cobrar (bruto) y su ⓘ ─────────────────────────────── */

/** El total del footer, tal cual lo publica el registro. Es `total` del contrato, NO la suma de los
 *  saldos de la tabla: `top_debtors` es un top, no la cartera entera. */
export function totalBruto(ar: AccountsReceivableResponse | null | undefined): number {
  return ar ? parseAmount(ar.total) : 0;
}

export interface ExplicacionV04 {
  definicion: string;
  incluye: string[];
  excluye: string[];
  fuente: string;
  frescura: string;
}

/** "¿Por qué bruto?" (§1.4: definición, incluye/excluye, fuente y frescura). Sólo afirma lo que el
 *  backend hace (verificado en `receivables_repo.accounts_receivable`). */
export function explicacionBruto(
  ar: AccountsReceivableResponse | null | undefined,
  hoy: Date,
): ExplicacionV04 {
  const undated = ar ? parseAmountOrNull(ar.undated_amount) : null;
  const excluye = [
    "Lo que marcaste cobrado a mano en Clientes: eso lo descuenta el neto conciliado de Cobrar clásico, no este número",
    "Las facturas cedidas por factoring: las cobra el factor, el registro las deja fuera",
  ];
  if (undated != null && undated > 0) {
    excluye.push(
      `Del aging (no del total): ${formatClp(undated)} sin fecha de vencimiento, que por eso no caen en ningún tramo`,
    );
  }
  return {
    definicion:
      "Por cobrar (bruto) es la suma del saldo pendiente de tus documentos de venta vivos según el registro de cobranza, neteado de notas de crédito. Sale del mismo registro que “Te deben” en Hoy, pero no es el mismo número: allá la cifra grande es lo VENCIDO y este total aparece en su detalle (“de $X por cobrar”). Lo vencido, acá, es la tarjeta “Vencido · bruto”.",
    incluye: [
      "Facturas abiertas o pagadas en parte, por lo que les falta",
      "Notas de crédito, restando",
    ],
    excluye,
    fuente: "Registro de cuentas por cobrar disponible en Qavante · la fuente no distingue moneda",
    frescura: ar?.generated_at
      ? `calculado ${formatRelative(ar.generated_at, hoy)} (${formatDateLong(ar.generated_at)})`
      : "sin fecha de cálculo",
  };
}

/** "¿Qué es Vencido · bruto?" — el ⓘ de la tarjeta (§1.4). */
export function explicacionVencido(
  ar: AccountsReceivableResponse | null | undefined,
  hoy: Date,
): ExplicacionV04 {
  const base = explicacionBruto(ar, hoy);
  const excluye = [
    "Documentos sin fecha de vencimiento (el SII no la entrega hasta el XML del DTE)",
    "Documentos con fecha estimada: sirven para ordenar, pero el registro no los cuenta como mora",
    "Facturas cedidas por factoring",
  ];
  const estimadas = estimadasDe(ar);
  if (estimadas != null && estimadas > 0) {
    excluye.push(
      `Hoy: ${estimadas} ${estimadas === 1 ? "documento" : "documentos"} con fecha estimada según el registro`,
    );
  }
  return {
    definicion:
      "Vencido (bruto) es la parte del por cobrar cuya fecha de vencimiento confirmada ya pasó, neteada de notas de crédito vencidas. Cuando el registro no tiene las fechas, no se calcula y se dice.",
    incluye: ["Saldo pendiente de facturas con fecha de vencimiento confirmada anterior a hoy"],
    excluye,
    fuente: base.fuente,
    frescura: base.frescura,
  };
}

/* ── (5) Acciones: los flujos actuales de Cobrar v2 ─────────────────────────── */

export interface RecordatorioV04 {
  key: string;
  nombre: string;
  /** El texto de la plantilla actual (`reminderText`, Cobrar v2). */
  texto: string;
  waHref: string;
  mailtoHref: string;
}

/** El recordatorio de un cliente con la plantilla ACTUAL. Si no se sabe su vencido, va en modo
 *  concentración: al cliente no se le afirma una mora que no verificamos. */
export function recordatorioDe(c: ClienteV04): RecordatorioV04 {
  const vencido = c.vencido ?? 0;
  const texto = reminderText({
    name: c.nombre,
    total: c.saldo,
    overdue: vencido > 0 ? vencido : 0,
    mode: vencido > 0 ? "urgencia" : "concentracion",
  });
  return {
    key: c.key,
    nombre: c.nombre,
    texto,
    waHref: waHref(texto),
    mailtoHref: mailtoHref(ASUNTO_RECORDATORIO, texto),
  };
}

/** El lote: las mismas plantillas, una por cliente, en el orden del banner. */
export function loteRecordatorios(clientes: ReadonlyArray<ClienteV04>): RecordatorioV04[] {
  return clientes.map(recordatorioDe);
}

/** IDs del lote real. Es una proyección, no una búsqueda: conserva exactamente los UUIDs que el
 * backend publicó y quita sólo duplicados. Una lista vacía significa "no sabemos qué documento
 * enviar", por lo que la vista no llama al endpoint. */
export function receivableIdsDeLote(clientes: ReadonlyArray<ClienteV04>): string[] {
  return [...new Set(clientes.flatMap((cliente) => cliente.receivableIds))];
}

/** Texto de la cuenta regresiva (Ley 4): qué va a pasar y en cuánto. */
export function textoCountdown(segundos: number, n: number): string {
  return `Enviando ${n === 1 ? "un recordatorio" : `${n} recordatorios`} en ${segundos} s`;
}

/* ── Exportar (§5.5) ─────────────────────────────────────────────────────────── */

/** Los documentos con fecha no confirmada del cliente, en una celda: "Factura 462: estimada · …".
 *  Vacío si todos están confirmados. La nota no va al CSV: es copy de pantalla, no un dato. */
export function certezasCsv(c: Pick<ClienteV04, "certezas">): string {
  return c.certezas.map((d) => `${d.documento}: ${CERTEZA_CSV[d.certeza]}`).join(" · ");
}

/** CSV con `;` (Excel es-CL). Montos crudos, sin formatear; el "no se sabe" va como "sin dato". */
export function csvClientesTable(clientes: ReadonlyArray<ClienteV04>): ExportTable {
  return exportTable(
    [
      "cliente",
      "rut",
      "saldo",
      "vencido",
      "dias_vencido",
      "antiguedad",
      "ultima_gestion",
      "fechas_no_confirmadas",
    ],
    clientes.map((c) => [
      csvCell.text(c.nombre),
      c.rut == null ? csvCell.missing() : csvCell.identifier(c.rut),
      csvCell.decimal(c.saldo),
      c.vencido == null ? csvCell.text("sin dato") : csvCell.decimal(c.vencido),
      c.dias == null ? csvCell.missing() : csvCell.integer(c.dias),
      csvCell.text(c.antiguedad.texto),
      c.ultimaGestion == null ? csvCell.missing() : csvCell.text(c.ultimaGestion),
      c.certezas.length === 0 ? csvCell.missing() : csvCell.text(certezasCsv(c)),
    ]),
  );
}

/** CSV interoperable: no contiene tipos de celda para Excel. */
export function csvClientes(clientes: ReadonlyArray<ClienteV04>): string {
  const table = csvClientesTable(clientes);
  return csv(table.headers, table.rows, table.dialect);
}
