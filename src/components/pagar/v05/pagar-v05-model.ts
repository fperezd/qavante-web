/* V05 · Pagar — el modelo PURO de la vista (rediseño Fase 2, issue #70).
 *
 * Contesta UNA pregunta: "¿a quién le pago, y qué es crítico?".
 *
 * Sin React a propósito, como `hoy-model.ts`, `caja-v02-model.ts`, `banco-v03-model.ts` y
 * `cobrar-v04-model.ts`: cada tarjeta, cada pill y cada conteo de esta pantalla es una afirmación
 * sobre plata que se fija en un test sin montar un DOM.
 *
 * FUENTE ÚNICA (verificada contra `src/lib/api/types.ts`, generado del OpenAPI vivo, y contra
 * `payables_repo.accounts_payable` en `qavante-api`, 2026-08-30):
 *   · `GET /api/treasury/accounts-payable` — `total` (CLP convertido), `total_by_currency` (crudo,
 *     sin convertir), `due_7d/14d/30d` (acumulativos, INCLUYEN lo vencido), `items` (sólo los que
 *     tienen `due_date`, ordenados por `due_date asc`, tope de 100), `undated_amount/undated_count`
 *     (lo que NO tiene fecha: no está en ningún tramo ni en `items`), `projected_cash_14d` con su
 *     `projected_cash_currency`, y `missing_sources`.
 *     Es la MISMA fuente de "Sale · 14 días" en V02 (Ley 1): "Por pagar · 14 días" de acá es
 *     `due_14d` tal cual, y el postergable del banner sale de la MISMA función (`sale14d`).
 *
 * LO QUE ESTE MÓDULO DECIDE, escrito acá y no sólo en el PR:
 *   · VENCIDO ≠ CRÍTICO. Vencido = todo lo que tiene `due_date` anterior a hoy, de cualquier tipo
 *     (en producción hoy incluye una factura de proveedor vencida hace ~18 meses). Crítico = lo
 *     que NO se posterga (Ley 9: impuestos, sueldos, deuda) y vence dentro de 14 días o ya venció.
 *     Una factura de proveedor vencida es "vencida" (ámbar) y negociable, no "crítica".
 *   · POSTERGABLE es por TIPO de pago, no por acuerdo con el proveedor: el backend no manda
 *     postergabilidad por ítem (es el gating de `pagarV2`, FE-first). Se reusa la heurística
 *     vigente (`postergabilidadDe`) para que el banner de acá y "Sale · 14 días" de V02 digan el
 *     mismo número. Impuestos y sueldos NUNCA son postergables (Ley 9), y el texto fijo de la ley
 *     se muestra literal.
 *   · POSIBLE DUPLICADO llega como un par de UUID de
 *     `GET /api/treasury/accounts-payable/anomalies`, calculado por el backend sobre todo el
 *     devengado elegible. Esta vista sólo relaciona esos UUID con `PayableItem.id`: NUNCA infiere
 *     identidad desde RUT, monto, fecha ni texto. Si esa señal no llega, la vista declara el
 *     "no sé" y no afirma que no existan duplicados.
 *   · LEY 2 — un rojo por pantalla. Si hay algún posible duplicado, el rojo es la pill "Revisar" del
 *     duplicado más urgente (revisar antes de pagar dos veces es lo crítico Y accionable de esta
 *     pantalla; los demás duplicados van en ámbar). Si no hay ninguno, el rojo es el relativo
 *     ("hace N días") de la fila crítica más urgente. Nunca los dos. El KPI "Vencido" NO va en rojo
 *     (el HTML de referencia lo pinta rojo; la spec manda en lógica).
 *   · "Servicio" (una de las cuatro pills de la spec) NO se produce: el contrato no distingue un
 *     servicio recurrente de una factura cualquiera, y adivinarlo sería un default plausible.
 *   · No hay "pagar todo" ni "postergar" en esta vista: mover plata lleva firma humana (Ley 9).
 *     La postergación operativa vive en Caja/Hoy, no acá. */

import type { AccountsPayableResponse, PayableDuplicatePair, PayableItem } from "@/lib/api/pagos";
import { parseAmount, parseAmountOrNull } from "@/lib/formatters/amount";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import { formatDateLong, formatDateShort, formatRelative } from "@/lib/formatters/date";
import { formatRut } from "@/lib/formatters/rut";
import { normalizeRut } from "@/lib/validators/rut";
import { montoCLP, montoCLPFaltante, payableItemLabel } from "../pagos-format";
import { payrollPeriodFromExternalId } from "../pagos-group";
import { postergabilidadDe } from "../v2/pagar-v2-map";
import { sale14d } from "@/components/caja/v02/caja-v02-model";

/** Ventana del "Crítico vs. caja" y del banner (la misma de V02: "Sale · 14 días"). */
export const VENTANA_DIAS = 14;
/** Los tres tramos que el backend publica (`due_7d`, `due_14d`, `due_30d`). */
export const PERIODOS = [7, 14, 30] as const;
export type PeriodoV05 = (typeof PERIODOS)[number];
/** Tope de `items` del endpoint (`_ITEMS_CAP` en `payables_repo.py`). */
export const TOPE_ITEMS = 100;
/** Texto FIJO de la Ley 9 (spec §2 y §5.10): se muestra literal donde la spec lo indica. */
export const LEY_9_TEXTO = "Impuestos y sueldos jamás entran en postergaciones automáticas.";

/* ── Fechas ──────────────────────────────────────────────────────────────────── */

/** Días civiles entre `hoy` (fecha LOCAL) y una fecha ISO (`YYYY-MM-DD`, con o sin hora). `null`
 *  si no se reconoce — y eso es "sin fecha", nunca 0 días. Mismo criterio que `hoy-model.ts`. */
export function diasHasta(iso: string | null | undefined, hoy: Date): number | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(iso ?? "");
  if (!m) return null;
  const objetivo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(objetivo)) return null;
  const base = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((objetivo - base) / 86_400_000);
}

/** Fecha absoluta (§1.4): corta si es del año en curso, larga si cruza de año (una factura vencida
 *  hace 18 meses como "3 mar" a secas se leería como de este año). "sin fecha" si no hay. */
export function venceLabelDe(iso: string | null | undefined, hoy: Date): string {
  if (diasHasta(iso, hoy) == null) return "sin fecha";
  const anio = Number(/^(\d{4})/.exec(iso ?? "")?.[1]);
  return anio === hoy.getFullYear() ? formatDateShort(iso) : formatDateLong(iso);
}

/* ── Tipo de pago (la pill) ──────────────────────────────────────────────────── */

export type TipoV05 = "negociable" | "credito" | "no_se_posterga" | "revisar";

export const TIPO_LABEL: Record<TipoV05, string> = {
  negociable: "Negociable",
  credito: "Crédito",
  no_se_posterga: "No se posterga",
  revisar: "Revisar",
};

/** Ley 9: impuestos y sueldos jamás se postergan. La deuda financiera tampoco (misma heurística
 *  que Pagar v2 y V02). */
export function esPostergable(item: Pick<PayableItem, "category" | "criticality">): boolean {
  if (item.category === "tax" || item.category === "payroll") return false;
  return postergabilidadDe(item as PayableItem) !== "no_postergable";
}

export function tipoDe(item: Pick<PayableItem, "category" | "criticality">): TipoV05 {
  if (item.category === "debt" || item.category === "leasing") return "credito";
  if (!esPostergable(item)) return "no_se_posterga";
  return "negociable";
}

/* ── Documento / identidad ───────────────────────────────────────────────────── */

const DTE_LABELS: Record<number, string> = {
  33: "Factura",
  34: "Factura exenta",
  46: "Factura de compra",
  56: "Nota de débito",
  61: "Nota de crédito",
};

/** "Factura 1201" desde `tipo_dte` + `folio`. `null` si no es un DTE (nómina, manual). */
export function documentoDe(item: Pick<PayableItem, "folio" | "tipo_dte">): string | null {
  if (item.folio == null) return null;
  const tipo = item.tipo_dte != null ? (DTE_LABELS[item.tipo_dte] ?? "Documento") : "Documento";
  return `${tipo} ${item.folio}`;
}

/** El nombre COMPLETO de la fila (Ley 7: nunca se trunca). Nómina → "Remuneraciones: Agosto 2026"
 *  (el backend manda `label` = "Remuneraciones" y la clave natural trae el período). El resto →
 *  la razón social de la contraparte; sin ella, el `label` del backend tal cual. */
export function nombreDe(item: PayableItem): string {
  if (item.category === "payroll") return payableItemLabel(item);
  return item.counterparty_name?.trim() || item.label;
}

/** RUT normalizado sólo para búsqueda de la fila; no participa en detectar anomalías. */
export function rutKeyDe(rut: string | null | undefined): string | null {
  const r = (rut ?? "").trim();
  if (!r) return null;
  const n = normalizeRut(r);
  return n.length >= 3 ? n : null;
}

/** Módulo con el detalle del pago, cuando existe. `null` = todavía no hay dónde ir (y no se pinta
 *  un link a ningún lado). */
export function hrefDe(item: PayableItem): string | null {
  if (item.category === "payroll") {
    const period = payrollPeriodFromExternalId(item.source_external_id);
    return period ? `/remuneraciones?period=${period}` : "/remuneraciones";
  }
  if (item.category === "tax") return "/pagar/impuestos";
  if (item.category === "debt" || item.category === "leasing") return "/pagar/obligaciones";
  if (item.category === "supplier" && item.folio != null) return "/pagar/facturas-recibidas";
  return null;
}

/* ── La fila ─────────────────────────────────────────────────────────────────── */

export interface AnomaliaV05 {
  tipo: "posible_duplicado";
  /** Clave de la fila con la que calza. */
  parKey: string;
  /** El `.sub` de la spec: por qué se marca. */
  detalle: string;
}

export interface PagoV05 {
  /** Clave de presentación. El UUID del item, si llegó; fallback sólo para React/orden, nunca para anomalías. */
  key: string;
  nombre: string;
  /** "Factura 1201" o `null`. */
  documento: string | null;
  rut: string | null;
  /** Para búsqueda y agrupación. */
  rutKey: string | null;
  rutLabel: string | null;
  categoria: PayableItem["category"];
  fuente: string;
  /** Criticidad que declara el backend (por proximidad). */
  criticidad: PayableItem["criticality"];
  dueDate: string | null;
  /** Días civiles hasta el vencimiento (negativo = vencido). `null` = SIN FECHA, nunca 0. */
  dias: number | null;
  /** "3 mar 2025" / "4 sep" / "sin fecha". */
  venceLabel: string;
  /** "hace 545 días" / "en 5 días" / "hoy" / "sin fecha". */
  relativoLabel: string;
  vencido: boolean;
  /** No se posterga y vence dentro de la ventana (o ya venció). */
  critico: boolean;
  /** Ley 9. */
  postergable: boolean;
  tipo: TipoV05;
  /** Monto en CLP para sumar. `null` = moneda extranjera SIN conversión (no se suma como pesos). */
  montoClp: number | null;
  /** Monto en su moneda de origen, formateado ("$1.207.105" / "US$ 1.240,00"). */
  montoLabel: string;
  moneda: string;
  sinConvertir: boolean;
  reclamado: boolean;
  anomalia: AnomaliaV05 | null;
  href: string | null;
  /** El `.sub`: documento · fuente (+ la anomalía o la nota de moneda). */
  sub: string;
  item: PayableItem;
}

function relativoDe(dias: number | null, dueDate: string | null, hoy: Date): string {
  if (dias == null || !dueDate) return "sin fecha";
  return formatRelative(dueDate, hoy);
}

function keyDe(item: PayableItem, i: number): string {
  return item.id?.trim() || item.source_external_id?.trim() || `${item.label}#${i}`;
}

function baseDe(item: PayableItem, i: number, hoy: Date): Omit<PagoV05, "anomalia" | "sub"> {
  const dueDate = item.due_date?.trim() ? item.due_date : null;
  const dias = diasHasta(dueDate, hoy);
  const moneda = (item.currency || "CLP").toUpperCase();
  const sinConvertir = montoCLPFaltante(item);
  const postergable = esPostergable(item);
  const rut = item.counterparty_rut?.trim() || null;
  return {
    key: keyDe(item, i),
    nombre: nombreDe(item),
    documento: documentoDe(item),
    rut,
    rutKey: rutKeyDe(rut),
    rutLabel: rut ? formatRut(rut) : null,
    categoria: item.category,
    fuente: item.source,
    criticidad: item.criticality,
    dueDate,
    dias,
    venceLabel: venceLabelDe(dueDate, hoy),
    relativoLabel: relativoDe(dias, dueDate, hoy),
    vencido: dias != null && dias < 0,
    critico: !postergable && dias != null && dias <= VENTANA_DIAS,
    postergable,
    tipo: tipoDe(item),
    montoClp: sinConvertir ? null : montoCLP(item),
    montoLabel: formatMoney(parseAmount(item.amount), moneda),
    moneda,
    sinConvertir,
    reclamado: item.reclamado === true,
    href: hrefDe(item),
    item,
  };
}

/* ── Posible duplicado ───────────────────────────────────────────────────────── */

/** Marca sólo los UUID que el backend publicó. No deduce pares de campos que pueden colisionar. */
function marcarDuplicados(
  base: ReadonlyArray<Omit<PagoV05, "anomalia" | "sub">>,
  pares: ReadonlyArray<PayableDuplicatePair>,
): Map<string, AnomaliaV05> {
  const out = new Map<string, AnomaliaV05>();
  const porId = new Map(
    base.flatMap((p) => (p.item.id?.trim() ? [[p.item.id.trim(), p] as const] : [])),
  );
  for (const par of pares) {
    for (const [id, otroId] of [
      [par.payable_id, par.duplicate_payable_id],
      [par.duplicate_payable_id, par.payable_id],
    ] as const) {
      const fila = porId.get(id);
      if (!fila || out.has(id)) continue;
      const otra = porId.get(otroId);
      out.set(id, {
        tipo: "posible_duplicado",
        parKey: otra?.key ?? otroId,
        detalle: otra
          ? `posible duplicado señalado por el registro: ${otra.documento ?? "otro pago"} (${otra.venceLabel}, ${otra.montoLabel})`
          : "posible duplicado señalado por el registro; el otro pago no está entre los visibles",
      });
    }
  }
  return out;
}

function subDe(p: Omit<PagoV05, "sub">): string {
  if (p.anomalia) return p.anomalia.detalle;
  const partes: string[] = [];
  if (p.documento) partes.push(p.documento);
  partes.push(p.fuente);
  if (p.reclamado) partes.push("reclamada al SII");
  if (p.sinConvertir) partes.push(`en ${p.moneda} sin tipo de cambio: no se suma como pesos`);
  else if (p.moneda !== "CLP") partes.push(`${formatClp(p.montoClp ?? 0)} al tipo de cambio`);
  return partes.join(" · ");
}

/* ── Orden por urgencia (default de la tabla) ───────────────────────────────── */

const RANGO_TIPO: Record<TipoV05, number> = {
  revisar: 0,
  no_se_posterga: 0,
  credito: 1,
  negociable: 2,
};

/** Urgencia = cronología: lo más vencido primero, después lo que vence antes, al final lo SIN
 *  FECHA (no se sabe cuándo vence: no se le inventa un lugar en el medio). A igual día, primero lo
 *  que no se posterga, después el monto mayor. Estable. */
export function ordenarPorUrgencia<
  T extends { dias: number | null; tipo: TipoV05; montoClp: number | null },
>(pagos: ReadonlyArray<T>): T[] {
  return pagos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const da = a.p.dias;
      const db = b.p.dias;
      if (da == null && db != null) return 1;
      if (da != null && db == null) return -1;
      if (da != null && db != null && da !== db) return da - db;
      const ra = RANGO_TIPO[a.p.tipo];
      const rb = RANGO_TIPO[b.p.tipo];
      if (ra !== rb) return ra - rb;
      const ma = a.p.montoClp ?? 0;
      const mb = b.p.montoClp ?? 0;
      if (ma !== mb) return mb - ma;
      return a.i - b.i;
    })
    .map((x) => x.p);
}

/** Las filas de la tabla, ordenadas por urgencia y con sus anomalías. Vacío sin respuesta. */
export function pagosV05(
  ap: AccountsPayableResponse | null | undefined,
  hoy: Date,
  pares: ReadonlyArray<PayableDuplicatePair> = [],
): PagoV05[] {
  const base = (ap?.items ?? []).map((it, i) => baseDe(it, i, hoy));
  const dups = marcarDuplicados(base, pares);
  const filas = base.map((b) => {
    const anomalia = dups.get(b.key) ?? null;
    const conAnomalia = { ...b, anomalia, tipo: anomalia ? ("revisar" as const) : b.tipo };
    return { ...conAnomalia, sub: subDe(conAnomalia) };
  });
  return ordenarPorUrgencia(filas);
}

/* ── Ley 2: el único rojo ────────────────────────────────────────────────────── */

export type RojoV05 = { key: string; motivo: "anomalia" | "critico" } | null;

/** El ÚNICO candidato a rojo de la pantalla. Ver el encabezado: la anomalía más urgente si hay
 *  alguna; si no, la fila crítica más urgente; si no, ninguno. `pagos` viene ya ordenado. */
export function elUnicoRojo(pagos: ReadonlyArray<PagoV05>): RojoV05 {
  const anomalia = pagos.find((p) => p.anomalia != null);
  if (anomalia) return { key: anomalia.key, motivo: "anomalia" };
  const critico = pagos.find((p) => p.critico);
  if (critico) return { key: critico.key, motivo: "critico" };
  return null;
}

/* ── (1) Tríada ──────────────────────────────────────────────────────────────── */

export interface VencidoV05 {
  /** Σ CLP de lo vencido (las extranjeras sin conversión NO se suman). */
  total: number;
  n: number;
  /** Días del vencido más antiguo. `null` sin vencidos. */
  masAntiguoDias: number | null;
  /** Cuánto de eso no se posterga (impuestos, sueldos, deuda). */
  noPostergable: number;
  sinConvertir: number;
}

export function kpiVencido(pagos: ReadonlyArray<PagoV05>): VencidoV05 {
  const v = pagos.filter((p) => p.vencido);
  let masAntiguo: number | null = null;
  for (const p of v) if (masAntiguo == null || p.dias! < masAntiguo) masAntiguo = p.dias!;
  return {
    total: v.reduce((s, p) => s + (p.montoClp ?? 0), 0),
    n: v.length,
    masAntiguoDias: masAntiguo == null ? null : -masAntiguo,
    noPostergable: v.filter((p) => !p.postergable).reduce((s, p) => s + (p.montoClp ?? 0), 0),
    sinConvertir: v.filter((p) => p.sinConvertir).length,
  };
}

export interface PorPagarV05 {
  periodo: PeriodoV05;
  /** `due_Nd` del backend (CLP convertido, acumulativo, INCLUYE lo vencido). `null` = no vino. */
  total: number | null;
  /** Lo que el backend NO pudo agendar: sin fecha de vencimiento. */
  sinFecha: { monto: number; n: number } | null;
}

/** "Por pagar · N días": el tramo del backend tal cual (Ley 1: el de 14 es "Sale · 14 días" en
 *  V02). No se recalcula desde las filas — `items` está topeado y las filas extranjeras sin TC no
 *  suman. */
export function kpiPorPagar(
  ap: AccountsPayableResponse | null | undefined,
  periodo: PeriodoV05,
): PorPagarV05 {
  const campo = periodo === 7 ? ap?.due_7d : periodo === 14 ? ap?.due_14d : ap?.due_30d;
  const undatedN = ap?.undated_count ?? 0;
  const undated = parseAmountOrNull(ap?.undated_amount);
  return {
    periodo,
    total: ap ? parseAmountOrNull(campo) : null,
    sinFecha: undatedN > 0 ? { monto: undated ?? 0, n: undatedN } : null,
  };
}

export interface CriticoV05 {
  /** Σ CLP de lo crítico (no se posterga y vence en ≤ 14 días o ya venció). */
  total: number;
  n: number;
  /** De eso, lo que YA venció. */
  yaVencido: number;
  /** Caja proyectada a 14 días en CLP, o `null` si no se puede comparar (ver `motivoSinCaja`). */
  caja: number | null;
  /** caja − crítico. `null` sin caja comparable. */
  brecha: number | null;
  motivoSinCaja: string | null;
}

/** "Crítico vs. caja". La caja es `projected_cash_14d` del MISMO endpoint, y sólo se compara si
 *  viene en CLP: el contrato la publica en la moneda funcional del tenant (`projected_cash_currency`)
 *  y dividir dólares por pesos ya pasó dos veces aguas arriba. */
export function kpiCritico(
  pagos: ReadonlyArray<PagoV05>,
  ap: AccountsPayableResponse | null | undefined,
): CriticoV05 {
  const c = pagos.filter((p) => p.critico);
  const total = c.reduce((s, p) => s + (p.montoClp ?? 0), 0);
  const yaVencido = c.filter((p) => p.vencido).reduce((s, p) => s + (p.montoClp ?? 0), 0);
  const cajaCruda = parseAmountOrNull(ap?.projected_cash_14d);
  const moneda = (ap?.projected_cash_currency || "CLP").toUpperCase();
  let caja: number | null = null;
  let motivo: string | null = null;
  if (!ap) motivo = "sin cuentas por pagar no hay caja proyectada que comparar";
  else if (cajaCruda == null) motivo = "el backend no pudo proyectar la caja a 14 días";
  else if (moneda !== "CLP")
    motivo = `la caja proyectada viene en ${moneda} y lo crítico está en pesos: no se comparan`;
  else caja = cajaCruda;
  return {
    total,
    n: c.length,
    yaVencido,
    caja,
    brecha: caja == null ? null : caja - total,
    motivoSinCaja: motivo,
  };
}

/* ── (2) Banner de postergables ──────────────────────────────────────────────── */

export interface PostergableV05 {
  /** Σ CLP de lo negociable que vence en 0..14 días — la MISMA función que V02 ("Sale · 14 días"). */
  monto: number;
  /** `due_14d` del backend. */
  ventana: number;
}

/** `null` cuando no hay nada postergable en la ventana (el banner no se muestra) o sin respuesta. */
export function bannerPostergables(
  ap: AccountsPayableResponse | null | undefined,
  hoy: Date,
): PostergableV05 | null {
  const s = sale14d(ap, hoy);
  if (!s || s.postergable <= 0) return null;
  return { monto: s.postergable, ventana: s.total };
}

/* ── (3) Filtros con conteo + búsqueda ───────────────────────────────────────── */

export type FiltroV05 =
  | "todos"
  | "vencidos"
  | "criticos"
  | "postergables"
  | "impuestos"
  | "remuneraciones"
  | "revisar"
  | "sin_fecha";

export const FILTROS_V05: ReadonlyArray<{ id: FiltroV05; label: string; condicional?: boolean }> = [
  { id: "todos", label: "Todos" },
  { id: "vencidos", label: "Vencidos" },
  { id: "criticos", label: "Críticos" },
  { id: "postergables", label: "Postergables" },
  { id: "impuestos", label: "Impuestos" },
  { id: "remuneraciones", label: "Remuneraciones" },
  /* Se ofrecen sólo cuando existen: un chip "Revisar · 0" es ruido. */
  { id: "revisar", label: "Revisar", condicional: true },
  { id: "sin_fecha", label: "Sin fecha", condicional: true },
];

export function pasaFiltro(p: PagoV05, filtro: FiltroV05): boolean {
  switch (filtro) {
    case "vencidos":
      return p.vencido;
    case "criticos":
      return p.critico;
    case "postergables":
      return p.postergable;
    case "impuestos":
      return p.categoria === "tax";
    case "remuneraciones":
      return p.categoria === "payroll";
    case "revisar":
      return p.anomalia != null;
    case "sin_fecha":
      return p.dias == null;
    default:
      return true;
  }
}

/** Búsqueda por proveedor (sin mayúsculas), folio o RUT (con o sin puntos y guion). Vacío → todos. */
export function coincideConsulta(
  p: Pick<PagoV05, "nombre" | "documento" | "rut" | "item">,
  consulta: string,
): boolean {
  const q = consulta.trim().toLowerCase();
  if (!q) return true;
  if (p.nombre.toLowerCase().includes(q)) return true;
  if (p.item.label.toLowerCase().includes(q)) return true;
  if (p.item.folio != null && String(p.item.folio).includes(q)) return true;
  const qRut = q.replace(/[.\-\s]/g, "");
  if (!qRut || !p.rut) return false;
  return p.rut
    .replace(/[.\-\s]/g, "")
    .toLowerCase()
    .includes(qRut);
}

export function filtrarPagos(
  pagos: ReadonlyArray<PagoV05>,
  filtro: FiltroV05,
  consulta = "",
): PagoV05[] {
  return pagos.filter((p) => coincideConsulta(p, consulta) && pasaFiltro(p, filtro));
}

/** Conteos de los chips (§1.3: "SIEMPRE con conteo"), sobre la búsqueda vigente. */
export function contarPagos(
  pagos: ReadonlyArray<PagoV05>,
  consulta = "",
): Record<FiltroV05, number> {
  const out: Record<FiltroV05, number> = {
    todos: 0,
    vencidos: 0,
    criticos: 0,
    postergables: 0,
    impuestos: 0,
    remuneraciones: 0,
    revisar: 0,
    sin_fecha: 0,
  };
  for (const p of pagos) {
    if (!coincideConsulta(p, consulta)) continue;
    for (const f of FILTROS_V05) if (pasaFiltro(p, f.id)) out[f.id] += 1;
  }
  return out;
}

/* ── (4) Footer: total por moneda (INV-FX-001) ───────────────────────────────── */

export interface TotalesV05 {
  /** `total` del backend: todo, CONVERTIDO a CLP (las monedas sin TC quedan fuera y se avisan). */
  totalClp: number | null;
  /** Desglose crudo por moneda, sin convertir, tal como lo publica el backend. */
  porMoneda: Array<{ moneda: string; monto: number; label: string }>;
  /** Filas listadas en otra moneda SIN conversión (no están en `totalClp`). */
  sinConvertir: number;
  /** El endpoint topea `items`: puede haber más pagos que filas. */
  posiblementeTopeado: boolean;
}

export function totales(
  ap: AccountsPayableResponse | null | undefined,
  pagos: ReadonlyArray<PagoV05>,
): TotalesV05 {
  const porMoneda = (ap?.total_by_currency ?? []).map((t) => {
    const moneda = (t.currency || "CLP").toUpperCase();
    const monto = parseAmount(t.amount);
    return { moneda, monto, label: formatMoney(monto, moneda) };
  });
  return {
    totalClp: ap ? parseAmountOrNull(ap.total) : null,
    porMoneda,
    sinConvertir: pagos.filter((p) => p.sinConvertir).length,
    posiblementeTopeado: (ap?.items?.length ?? 0) >= TOPE_ITEMS,
  };
}

/* ── ⓘ (§1.4: definición, incluye/excluye, fuente y frescura) ────────────────── */

export interface ExplicacionV05 {
  definicion: string;
  incluye: string[];
  excluye: string[];
  fuente: string;
  frescura: string;
}

function frescuraDe(ap: AccountsPayableResponse | null | undefined, hoy: Date): string {
  return ap?.generated_at
    ? `calculado ${formatRelative(ap.generated_at, hoy)} (${formatDateLong(ap.generated_at)})`
    : "sin fecha de cálculo";
}

const FUENTE = "GET /api/treasury/accounts-payable · la misma fuente que “Sale · 14 días” en Caja";

export function explicacionVencido(
  ap: AccountsPayableResponse | null | undefined,
  hoy: Date,
): ExplicacionV05 {
  const excluye = [
    "Documentos sin fecha de vencimiento: el endpoint no los lista ni los pone en ningún tramo",
    "Pagos en otra moneda sin tipo de cambio: no se suman como pesos",
  ];
  const n = ap?.undated_count ?? 0;
  if (n > 0) {
    excluye.push(
      `Hoy: ${n} ${n === 1 ? "documento" : "documentos"} por ${formatClp(parseAmount(ap?.undated_amount))} sin fecha`,
    );
  }
  return {
    definicion:
      "Vencido es la suma, en pesos, de los pagos listados cuya fecha de vencimiento ya pasó · de cualquier tipo. No es lo mismo que crítico: una factura de proveedor vencida se negocia; un impuesto vencido no.",
    incluye: [
      "Facturas de compra abiertas o pagadas en parte, por lo que les falta",
      "Sueldos, impuestos y cuotas de deuda con fecha vencida",
    ],
    excluye,
    fuente: FUENTE,
    frescura: frescuraDe(ap, hoy),
  };
}

export function explicacionPorPagar(
  ap: AccountsPayableResponse | null | undefined,
  periodo: PeriodoV05,
  hoy: Date,
): ExplicacionV05 {
  return {
    definicion: `Por pagar · ${periodo} días es lo que vence de aquí a ${periodo} días, convertido a pesos, e INCLUYE lo ya vencido. Es el número que publica el backend, no una suma de la tabla.`,
    incluye: ["Todo lo listado con vencimiento hasta ese día, más lo vencido"],
    excluye: [
      "Documentos sin fecha de vencimiento (no están en ningún tramo)",
      "Monedas sin tipo de cambio (el backend las avisa en “fuentes que faltan”)",
    ],
    fuente: FUENTE,
    frescura: frescuraDe(ap, hoy),
  };
}

export function explicacionCritico(
  ap: AccountsPayableResponse | null | undefined,
  hoy: Date,
): ExplicacionV05 {
  return {
    definicion: `Crítico es lo que no se posterga ·impuestos, sueldos y deuda financiera· y vence dentro de ${VENTANA_DIAS} días o ya venció. Se compara con la caja proyectada a ${VENTANA_DIAS} días del mismo endpoint; la brecha es caja menos crítico, o sea lo que faltaría aun postergando todo lo negociable.`,
    incluye: ["Impuestos, sueldos, cotizaciones y cuotas de deuda con vencimiento en la ventana"],
    excluye: [
      "Proveedores y arriendos: son negociables por tipo de pago (el backend no manda postergabilidad por documento)",
      "Documentos sin fecha de vencimiento",
      "La caja cuando el backend no la proyecta o viene en otra moneda",
    ],
    fuente: FUENTE,
    frescura: frescuraDe(ap, hoy),
  };
}

/* ── Estado sin datos ────────────────────────────────────────────────────────── */

/** Qué falta según el backend, en una frase. `null` si no declara nada. */
export function faltantes(ap: AccountsPayableResponse | null | undefined): string | null {
  const f = (ap?.missing_sources ?? []).map((s) => s.trim()).filter(Boolean);
  return f.length > 0 ? f.join(" · ") : null;
}

/* ── Exportar (§5.5) ─────────────────────────────────────────────────────────── */

function csvCampo(v: string | number | null): string {
  if (v == null) return "";
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con `;` (Excel es-CL). Montos crudos en su moneda; el CLP convertido aparte; el "no sé" va
 *  como "sin dato"/"sin fecha". */
export function csvPagos(pagos: ReadonlyArray<PagoV05>): string {
  const filas = [
    [
      "proveedor",
      "documento",
      "rut",
      "vence",
      "dias",
      "tipo",
      "moneda",
      "monto",
      "monto_clp",
      "fuente",
      "anomalia",
    ].join(";"),
    ...pagos.map((p) =>
      [
        csvCampo(p.nombre),
        csvCampo(p.documento),
        csvCampo(p.rut),
        p.dueDate == null ? "sin fecha" : csvCampo(p.dueDate),
        p.dias == null ? "sin fecha" : csvCampo(p.dias),
        csvCampo(TIPO_LABEL[p.tipo]),
        csvCampo(p.moneda),
        csvCampo(parseAmount(p.item.amount)),
        p.montoClp == null ? "sin dato" : csvCampo(p.montoClp),
        csvCampo(p.fuente),
        csvCampo(p.anomalia?.detalle ?? null),
      ].join(";"),
    ),
  ];
  return filas.join("\n");
}
