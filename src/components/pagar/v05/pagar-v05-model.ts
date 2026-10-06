import { exportTable, type ExportTable } from "@/lib/export/table";
/* V05 · Pagar — el modelo PURO de la vista (rediseño Fase 2, issue #70).
 *
 * Contesta UNA pregunta: "¿a quién le pago, y qué es crítico?".
 *
 * Sin React a propósito, como `hoy-model.ts`, `caja-v02-model.ts` y `banco-v03-model.ts`: cada
 * tarjeta, cada pill y cada conteo de esta pantalla es una afirmación
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
 *     `due_14d` tal cual.
 *
 * LO QUE ESTE MÓDULO DECIDE, escrito acá y no sólo en el PR:
 *   · VENCIDO ≠ CRÍTICO. Vencido = todo lo que tiene `due_date` anterior a hoy, de cualquier tipo
 *     (en producción hoy incluye una factura de proveedor vencida hace ~18 meses). Crítico = lo
 *     que NO se posterga (Ley 9: impuestos, sueldos, deuda) y vence dentro de 14 días o ya venció.
 *     Una factura de proveedor vencida es "vencida" (ámbar) y negociable, no "crítica".
 *   · POSTERGABLE es por TIPO de pago, no por acuerdo con el proveedor: el backend no manda
 *     postergabilidad por ítem (es el gating de `pagarV2`, FE-first). El filtro conserva la
 *     clasificación vigente (`postergabilidadDe`), pero la vista no suma la página para publicar
 *     un monto global. Impuestos y sueldos NUNCA son postergables (Ley 9).
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
 *     La postergación operativa vive en Caja/Hoy, no acá.
 *   · CERTEZA DE LA FECHA es server-owned (`due_date_certainty` + `due_date_note`, ver
 *     `rediseno/certeza-vencimiento.ts`). Una fila `estimated`/`unconfirmed` lleva la pill y la
 *     nota tal cual llegan; se ordena por su fecha pero NUNCA cuenta como vencida ni como crítica
 *     (el backend tampoco la mete en `due_*` ni en el agregado crítico). Sin el campo, la fila NO
 *     se asume confirmada: se marca "certeza no informada". `estimated_due_date_count` se publica
 *     en "Por pagar" como conteo del servidor, fuera de los tramos. */

import type {
  AccountsPayableQuery,
  D02AccountsPayableResponse as AccountsPayableResponse,
  PayableDuplicatePair,
  PayableItem,
} from "@/lib/api/pagos";
import {
  MONTO_EN_REVISION,
  importeDesconocido,
  parseAmount,
  parseAmountOrNull,
} from "@/lib/formatters/amount";
import { csv, csvCell } from "@/lib/export/csv";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import { formatDateLong, formatDateShort, formatRelative } from "@/lib/formatters/date";
import { formatRut } from "@/lib/formatters/rut";
import { normalizeRut } from "@/lib/validators/rut";
import { montoCLP, montoCLPFaltante, montoEnRevision, payableItemLabel } from "../pagos-format";
import { payrollPeriodFromExternalId } from "../pagos-group";
import { postergabilidadDe } from "../v2/pagar-v2-map";
import {
  CERTEZA_CSV,
  certezaDe,
  certezaTexto,
  conteoEstimadasDe,
  esConfirmada,
  type CertezaPresentada,
} from "@/components/rediseno/certeza-vencimiento";

/** Ventana del contexto crítico. */
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
  /** Certeza server-owned de la fecha. `no_informada` si el ítem no trae el campo. */
  certeza: CertezaPresentada;
  /** `due_date_note` tal cual (recortada), o `null`. Nunca se inventa. */
  notaVencimiento: string | null;
  /** Fecha anterior a hoy Y confirmada. Una fecha estimada o sin confirmar nunca es "vencida". */
  vencido: boolean;
  /** No se posterga y vence dentro de la ventana (o ya venció), con fecha confirmada. */
  critico: boolean;
  /** Ley 9. */
  postergable: boolean;
  /** `null` en modo de evidencia: no se fabrica una taxonomía local de decisión. */
  tipo: TipoV05 | null;
  /** Monto en CLP para sumar. `null` = moneda extranjera SIN conversión (no se suma como pesos). */
  montoClp: number | null;
  /** Monto en su moneda de origen, formateado ("$1.207.105" / "US$ 1.240,00"). */
  montoLabel: string;
  moneda: string;
  sinConvertir: boolean;
  /** Saldo DESCONOCIDO por cuarentena de conciliación (qavante-api#907): sin cifra, no suma y
   *  no es "sin convertir". */
  enRevision: boolean;
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

function baseDe(
  item: PayableItem,
  i: number,
  hoy: Date,
  includeDecisionSignals = true,
): Omit<PagoV05, "anomalia" | "sub"> {
  const dueDate = item.due_date?.trim() ? item.due_date : null;
  const dias = diasHasta(dueDate, hoy);
  /* Una fila sin moneda declarada NO se asume CLP: se rotula como sin moneda y queda fuera del
     total en pesos (INV-FX-001). */
  const moneda = item.currency?.trim().toUpperCase() || "SIN MONEDA";
  // #907: un saldo en cuarentena no tiene cifra. No se rotula "sin convertir" ni vale 0.
  const enRevision = montoEnRevision(item);
  const sinConvertir = !enRevision && (moneda === "SIN MONEDA" || montoCLPFaltante(item));
  // El Brief canónico es el único dueño de "qué postergar". En modo evidencia no ejecutamos esta
  // heurística por tipo de pago ni construimos su taxonomía para la fila.
  const postergable = includeDecisionSignals ? esPostergable(item) : false;
  const rut = item.counterparty_rut?.trim() || null;
  /* Sólo una fecha CONFIRMADA sustenta un vencido o un crítico derivado acá: `estimated`,
     `unconfirmed` y "no informada" se ordenan por fecha pero no se presentan como mora. */
  const { certeza, nota } = certezaDe(item);
  const confirmada = esConfirmada(certeza);
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
    certeza,
    notaVencimiento: nota,
    vencido: confirmada && dias != null && dias < 0,
    critico:
      includeDecisionSignals && confirmada && !postergable && dias != null && dias <= VENTANA_DIAS,
    postergable,
    tipo: includeDecisionSignals ? tipoDe(item) : null,
    montoClp: sinConvertir || enRevision ? null : montoCLP(item),
    montoLabel:
      item.amount == null ? MONTO_EN_REVISION : formatMoney(parseAmount(item.amount), moneda),
    moneda,
    sinConvertir,
    enRevision,
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
  /* La nota de certeza es copy del servidor y va tal cual, también cuando la fila lleva una
     anomalía: la pill dice el estado; la nota dice por qué. */
  const nota = p.notaVencimiento;
  if (p.anomalia) return nota ? `${p.anomalia.detalle} · ${nota}` : p.anomalia.detalle;
  const partes: string[] = [];
  if (p.documento) partes.push(p.documento);
  partes.push(p.fuente);
  if (p.reclamado) partes.push("reclamada al SII");
  if (p.enRevision) partes.push("monto en revisión de conciliación: no se suma");
  if (p.sinConvertir) partes.push(`en ${p.moneda} sin tipo de cambio: no se suma como pesos`);
  else if (p.moneda !== "CLP") partes.push(`${formatClp(p.montoClp ?? 0)} al tipo de cambio`);
  if (nota) partes.push(nota);
  return partes.join(" · ");
}

/** Texto de certeza para la fila ("Fecha estimada · <nota>"), `null` si la fecha es confirmada. */
export function certezaLabelDe(p: Pick<PagoV05, "certeza" | "notaVencimiento">): string | null {
  return certezaTexto({ certeza: p.certeza, nota: p.notaVencimiento });
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
  T extends { dias: number | null; tipo: TipoV05 | null; montoClp: number | null },
>(pagos: ReadonlyArray<T>): T[] {
  return pagos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const da = a.p.dias;
      const db = b.p.dias;
      if (da == null && db != null) return 1;
      if (da != null && db == null) return -1;
      if (da != null && db != null && da !== db) return da - db;
      const ra = a.p.tipo == null ? Number.MAX_SAFE_INTEGER : RANGO_TIPO[a.p.tipo];
      const rb = b.p.tipo == null ? Number.MAX_SAFE_INTEGER : RANGO_TIPO[b.p.tipo];
      if (ra !== rb) return ra - rb;
      const ma = a.p.montoClp ?? 0;
      const mb = b.p.montoClp ?? 0;
      if (ma !== mb) return mb - ma;
      return a.i - b.i;
    })
    .map((x) => x.p);
}

export type PagosV05Order = "urgency" | "source";

export interface PagosV05Options {
  /** `source` conserva exactamente el orden publicado por accounts-payable. */
  order?: PagosV05Order;
  /** Las señales de postergabilidad/criticidad son heurísticas heredadas, no evidencia del Brief. */
  includeDecisionSignals?: boolean;
}

/** Las filas de la tabla, con anomalías que publicó el backend. El default conserva el orden de
 * urgencia histórico; el Brief solicita `source` y sin señales de decisión para que la tabla sea
 * sólo evidencia. */
export function pagosV05(
  ap: AccountsPayableResponse | null | undefined,
  hoy: Date,
  pares: ReadonlyArray<PayableDuplicatePair> = [],
  options: PagosV05Options = {},
): PagoV05[] {
  const includeDecisionSignals = options.includeDecisionSignals !== false;
  const base = (ap?.items ?? []).map((it, i) => baseDe(it, i, hoy, includeDecisionSignals));
  const dups = marcarDuplicados(base, pares);
  const filas = base.map((b) => {
    const anomalia = dups.get(b.key) ?? null;
    const conAnomalia = {
      ...b,
      anomalia,
      tipo: includeDecisionSignals && anomalia ? ("revisar" as const) : b.tipo,
    };
    return { ...conAnomalia, sub: subDe(conAnomalia) };
  });
  return options.order === "source" ? filas : ordenarPorUrgencia(filas);
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
  /** Σ CLP de lo vencido (las extranjeras sin conversión NO se suman). `null` si alguna fila
   *  vencida está en revisión de conciliación (#907): una suma con un sumando desconocido es
   *  desconocida, no un piso. */
  total: number | null;
  n: number;
  /** Días del vencido más antiguo. `null` sin vencidos. */
  masAntiguoDias: number | null;
  /** Cuánto de eso no se posterga (impuestos, sueldos, deuda). `null` = en revisión (#907). */
  noPostergable: number | null;
  sinConvertir: number;
}

export function kpiVencido(pagos: ReadonlyArray<PagoV05>): VencidoV05 {
  const v = pagos.filter((p) => p.vencido);
  let masAntiguo: number | null = null;
  for (const p of v) if (masAntiguo == null || p.dias! < masAntiguo) masAntiguo = p.dias!;
  return {
    total: v.some((p) => p.enRevision) ? null : v.reduce((s, p) => s + (p.montoClp ?? 0), 0),
    n: v.length,
    masAntiguoDias: masAntiguo == null ? null : -masAntiguo,
    noPostergable: v.some((p) => !p.postergable && p.enRevision)
      ? null
      : v.filter((p) => !p.postergable).reduce((s, p) => s + (p.montoClp ?? 0), 0),
    sinConvertir: v.filter((p) => p.sinConvertir).length,
  };
}

export interface AgregadoGlobalV05 {
  total: number | null;
  /** Parte conocida. `null` cuando el agregado está en revisión (#907): no hay parte conocida. */
  conocido: number | null;
  /** Cuarentena de conciliación viva: el monto es desconocido, no cero. */
  enRevision: boolean;
  n: number;
  completo: boolean;
  sinFecha: number;
  monedasExcluidas: number;
}

/** KPI global D02: jamás deriva el monto desde la página visible. */
export function kpiVencidoGlobal(
  ap: AccountsPayableResponse | null | undefined,
): AgregadoGlobalV05 {
  const summary = ap?.overdue_summary;
  return {
    total: summary?.complete ? parseAmountOrNull(summary.amount_clp) : null,
    conocido: parseAmountOrNull(summary?.known_amount_clp),
    enRevision: importeDesconocido(summary),
    n: summary?.count ?? 0,
    completo: summary?.complete === true,
    sinFecha: summary?.unknown_due_date_count ?? 0,
    monedasExcluidas: summary?.excluded_by_currency.length ?? 0,
  };
}

export interface PorPagarV05 {
  periodo: PeriodoV05;
  /** `due_Nd` del backend (CLP convertido, acumulativo, INCLUYE lo vencido). `null` = no vino
   *  o está en revisión (ver `enRevision`). */
  total: number | null;
  /** Cuarentena de conciliación viva (#907): el tramo es desconocido, no cero. */
  enRevision: boolean;
  /** Lo que el backend NO pudo agendar: sin fecha de vencimiento. */
  sinFecha: { monto: number | null; n: number } | null;
  /** `estimated_due_date_count` del backend: pagos con fecha estimada, que NO entran en ningún
   *  tramo `due_*`. `null` si el campo no vino (no se asume 0). */
  estimadas: number | null;
}

/** El conteo de fechas estimadas que publica el servidor. `null` = no vino; nunca 0 por defecto. */
export function estimadasDe(ap: AccountsPayableResponse | null | undefined): number | null {
  return conteoEstimadasDe(ap?.estimated_due_date_count);
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
    enRevision: importeDesconocido(ap),
    sinFecha: undatedN > 0 ? { monto: undated, n: undatedN } : null,
    estimadas: estimadasDe(ap),
  };
}

export interface CriticoV05 {
  /** Σ CLP conocido del agregado crítico global del API. `null` = en revisión (#907). */
  total: number | null;
  /** Cuarentena de conciliación viva: el agregado crítico es desconocido, no cero. */
  enRevision: boolean;
  n: number;
  /** Obligaciones cuya fecha no permitió clasificarlas en el agregado. */
  fechasDesconocidas: number;
  /** Buckets de moneda excluidos; nunca se interpreta como cantidad de pagos. */
  monedasExcluidas: number;
  completo: boolean;
  /** De eso, lo que YA venció. `null` = en revisión (#907). */
  yaVencido: number | null;
  /** Saldo FINAL proyectado al día 14. Ya incluye los pagos comprometidos. */
  cajaFinal: number | null;
  /** Moneda funcional del saldo proyectado. `null` = no verificada (#370): sin moneda no hay
   *  cifra, y nunca se asume CLP. */
  monedaCaja: string | null;
  /** Juicio triestado canónico del API. `null` no se convierte en `false`. */
  cobertura: boolean | null;
  motivoSinCaja: string | null;
  motivoSinCobertura: string | null;
}

/** Caja y críticos como cifras separadas. `projected_cash_14d` es el saldo FINAL
 * del flujo: los pagos ya fueron descontados. Por eso jamás se calcula
 * `caja - crítico`. La cobertura se consume de `covers_critical`, cuya fórmula y
 * abstenciones pertenecen al backend. */
export function kpiCritico(
  _pagos: ReadonlyArray<PagoV05>,
  ap: AccountsPayableResponse | null | undefined,
): CriticoV05 {
  const summary = ap?.non_postponable_or_overdue_14d;
  const overdue = ap?.overdue_summary;
  const enRevision = importeDesconocido(summary);
  const total = enRevision
    ? null
    : parseAmount(summary?.complete ? summary.amount_clp : summary?.known_amount_clp);
  const fechasDesconocidas = summary?.unknown_due_date_count ?? 0;
  const monedasExcluidas = summary?.excluded_by_currency.length ?? 0;
  const yaVencido = importeDesconocido(overdue)
    ? null
    : parseAmount(overdue?.complete ? overdue.amount_clp : overdue?.known_amount_clp);
  const cajaPublicable = ap?.cash_projection_publicable_14d === true;
  // #370 (qavante-api#905): `projected_cash_currency` puede venir `null`. Una cifra sin unidad
  // verificada no se publica: ni se rotula "CLP" ni se muestra el número a secas.
  const monedaCaja = ap?.projected_cash_currency?.trim().toUpperCase() || null;
  const cajaFinal =
    cajaPublicable && monedaCaja != null ? parseAmountOrNull(ap?.projected_cash_14d) : null;
  const cobertura = ap?.covers_critical ?? null;
  const motivoSinCaja = !ap
    ? "sin cuentas por pagar no llegó el saldo proyectado"
    : importeDesconocido(ap)
      ? "la caja proyectada descuenta pagos en revisión de conciliación, así que no la mostramos"
      : monedaCaja == null
        ? "la moneda del saldo proyectado no está verificada, así que no lo mostramos"
        : !cajaPublicable || cajaFinal == null
          ? "no se pudo proyectar el saldo final a 14 días"
          : null;
  const motivoSinCobertura = !ap
    ? "sin cuentas por pagar no llegó el estado de cobertura"
    : cobertura == null
      ? "no se pudo determinar la cobertura con los datos disponibles"
      : null;
  return {
    total,
    enRevision,
    n: summary?.count ?? 0,
    fechasDesconocidas,
    monedasExcluidas,
    completo: summary?.complete === true,
    yaVencido,
    cajaFinal,
    monedaCaja,
    cobertura,
    motivoSinCaja,
    motivoSinCobertura,
  };
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

export type FiltroServidorV05 =
  | "todos"
  | "vencidos"
  | "alta"
  | "media"
  | "baja"
  | "impuestos"
  | "remuneraciones"
  | "pago_parcial";

export const FILTROS_SERVIDOR_V05: ReadonlyArray<{ id: FiltroServidorV05; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "vencidos", label: "Vencidos" },
  { id: "alta", label: "Alta" },
  { id: "media", label: "Media" },
  { id: "baja", label: "Baja" },
  { id: "impuestos", label: "Impuestos" },
  { id: "remuneraciones", label: "Remuneraciones" },
  { id: "pago_parcial", label: "Pago parcial" },
];

export function queryFiltroServidor(
  filtro: FiltroServidorV05,
  asOf?: string,
): AccountsPayableQuery {
  switch (filtro) {
    case "vencidos":
      return asOf ? { due_to: isoDayBefore(asOf) } : {};
    case "alta":
    case "media":
    case "baja":
      return { criticality: filtro === "alta" ? "high" : filtro === "media" ? "medium" : "low" };
    case "impuestos":
      return { category: "tax" };
    case "remuneraciones":
      return { category: "payroll" };
    case "pago_parcial":
      return { state: "partially_paid" };
    default:
      return {};
  }
}

function isoDayBefore(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function conteosServidor(ap: AccountsPayableResponse): Record<FiltroServidorV05, number> {
  const category = Object.fromEntries(
    ap.filter_metadata.by_category.map((f) => [f.category, f.count]),
  );
  const criticality = Object.fromEntries(
    ap.filter_metadata.by_criticality.map((f) => [f.criticality, f.count]),
  );
  const state = Object.fromEntries(ap.filter_metadata.by_state.map((f) => [f.state, f.count]));
  return {
    todos: ap.filter_metadata.unfiltered_items_total,
    vencidos: ap.overdue_summary.count,
    alta: criticality.high ?? 0,
    media: criticality.medium ?? 0,
    baja: criticality.low ?? 0,
    impuestos: category.tax ?? 0,
    remuneraciones: category.payroll ?? 0,
    pago_parcial: state.partially_paid ?? 0,
  };
}

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
  /** Desglose crudo por moneda, sin convertir, tal como lo publica el backend. `monto: null` =
   *  moneda en revisión de conciliación (#907). */
  porMoneda: Array<{ moneda: string; monto: number | null; label: string }>;
  /** Cuarentena AP viva: el total es desconocido, no cero. */
  enRevision: boolean;
  /** Filas listadas en otra moneda SIN conversión (no están en `totalClp`). */
  sinConvertir: number;
  /** El endpoint topea `items`: puede haber más pagos que filas. */
  posiblementeTopeado: boolean;
}

export function totales(
  ap: AccountsPayableResponse | null | undefined,
  pagos: ReadonlyArray<PagoV05>,
): TotalesV05 {
  const porMoneda = (ap?.total_by_currency ?? []).flatMap((t) => {
    if (t.currency_status !== "verified" || typeof t.currency !== "string") return [];
    const moneda = t.currency.toUpperCase();
    if (t.amount == null) return { moneda, monto: null, label: MONTO_EN_REVISION.toLowerCase() };
    const monto = parseAmount(t.amount);
    return { moneda, monto, label: formatMoney(monto, moneda) };
  });
  return {
    totalClp: ap ? parseAmountOrNull(ap.total) : null,
    enRevision: importeDesconocido(ap),
    porMoneda,
    sinConvertir: pagos.filter((p) => p.sinConvertir).length,
    posiblementeTopeado: ap?.has_more === true,
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

const FUENTE = "Cuentas por pagar y flujo de caja registrados en Qavante";

export function explicacionVencido(
  ap: AccountsPayableResponse | null | undefined,
  hoy: Date,
): ExplicacionV05 {
  const excluye = [
    "Documentos sin fecha de vencimiento: no se incluyen en la lista ni en los tramos por fecha",
    "Pagos en otra moneda sin tipo de cambio: no se suman como pesos",
  ];
  const n = ap?.undated_count ?? 0;
  if (n > 0) {
    const monto = parseAmountOrNull(ap?.undated_amount);
    excluye.push(
      monto == null
        ? `Hoy: ${n} ${n === 1 ? "documento" : "documentos"} con monto no disponible sin fecha`
        : `Hoy: ${n} ${n === 1 ? "documento" : "documentos"} por ${formatClp(monto)} sin fecha`,
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

/** Variante de evidencia del mismo dato. El Brief ya decide qué pago tratar primero;
 * por eso esta ayuda no introduce la taxonomía local de criticidad/postergabilidad. */
export function explicacionVencidoEvidencia(
  ap: AccountsPayableResponse | null | undefined,
  hoy: Date,
): ExplicacionV05 {
  const explicacion = explicacionVencido(ap, hoy);
  return {
    ...explicacion,
    definicion:
      "Vencido es la suma, en pesos, de los pagos listados cuya fecha de vencimiento ya pasó. Es un dato de fecha de cada registro.",
  };
}

export function explicacionPorPagar(
  ap: AccountsPayableResponse | null | undefined,
  periodo: PeriodoV05,
  hoy: Date,
): ExplicacionV05 {
  const excluye = [
    "Documentos sin fecha de vencimiento (no están en ningún tramo)",
    "Pagos con fecha estimada: el registro los cuenta aparte y no los mete en ningún tramo",
    "Monedas sin tipo de cambio, informadas como fuentes faltantes",
  ];
  const estimadas = estimadasDe(ap);
  if (estimadas != null && estimadas > 0) {
    excluye.push(
      `Hoy: ${estimadas} ${estimadas === 1 ? "pago" : "pagos"} con fecha estimada según el registro`,
    );
  }
  return {
    definicion: `Por pagar · ${periodo} días es lo que vence de aquí a ${periodo} días, convertido a pesos, e INCLUYE lo ya vencido. Este total viene de la consulta completa y no se recalcula desde la tabla visible.`,
    incluye: ["Todo lo listado con vencimiento confirmado hasta ese día, más lo vencido"],
    excluye,
    fuente: FUENTE,
    frescura: frescuraDe(ap, hoy),
  };
}

export function explicacionCritico(
  ap: AccountsPayableResponse | null | undefined,
  hoy: Date,
): ExplicacionV05 {
  return {
    definicion: `El saldo proyectado es la caja final al día ${VENTANA_DIAS} del flujo vigente y ya incluye los pagos comprometidos. El agregado crítico se calcula sobre todo el registro: pagos vencidos y lo que no se posterga ·impuestos, sueldos y deuda financiera· dentro de ${VENTANA_DIAS} días. Si faltan fechas o tipos de cambio, publica sólo la parte conocida y se declara incompleto. No se resta de la caja. La cobertura se informa por separado y no se deriva del subtotal visible. Esta consulta no informa la caja mínima dentro del horizonte.`,
    incluye: ["Impuestos, sueldos, cotizaciones y cuotas de deuda con vencimiento en la ventana"],
    excluye: [
      "Proveedores y arriendos: se muestran como negociables según el tipo de pago",
      "Documentos sin fecha de vencimiento",
      "Caja mínima dentro del horizonte: esta consulta no la informa",
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

/** CSV con `;` (Excel es-CL). Montos crudos en su moneda; el CLP convertido aparte; el "no sé" va
 *  como "sin dato"/"sin fecha". Cuando el Brief es dueño de la decisión, `tipo` se omite: es una
 *  taxonomía heurística heredada, no una etiqueta publicada por el servidor. */
export function csvPagosTable(
  pagos: ReadonlyArray<PagoV05>,
  { includeDecisionSignals = true }: { includeDecisionSignals?: boolean } = {},
): ExportTable {
  return exportTable(
    [
      "proveedor",
      "documento",
      "rut",
      "vence",
      "dias",
      "certeza_fecha",
      "nota_fecha",
      ...(includeDecisionSignals ? ["tipo"] : []),
      "moneda",
      "monto",
      "monto_clp",
      "fuente",
      "anomalia",
    ],
    pagos.map((p) => [
      csvCell.text(p.nombre),
      p.documento == null ? csvCell.missing() : csvCell.identifier(p.documento),
      p.rut == null ? csvCell.missing() : csvCell.identifier(p.rut),
      p.dueDate == null ? csvCell.text("sin fecha") : csvCell.date(p.dueDate),
      p.dias == null ? csvCell.text("sin fecha") : csvCell.integer(p.dias),
      csvCell.text(CERTEZA_CSV[p.certeza]),
      p.notaVencimiento == null ? csvCell.missing() : csvCell.text(p.notaVencimiento),
      ...(includeDecisionSignals
        ? [p.tipo == null ? csvCell.missing() : csvCell.text(TIPO_LABEL[p.tipo])]
        : []),
      csvCell.text(p.moneda),
      p.item.amount == null
        ? csvCell.text("en revisión")
        : csvCell.decimal(parseAmount(p.item.amount)),
      p.montoClp == null ? csvCell.text("sin dato") : csvCell.decimal(p.montoClp),
      csvCell.text(p.fuente),
      p.anomalia?.detalle == null ? csvCell.missing() : csvCell.text(p.anomalia.detalle),
    ]),
  );
}

export function nombreExportPagina(pagina: number): string {
  return `pagos-por-pagar-pagina-${Math.max(1, Math.trunc(pagina))}.xlsx`;
}

/** CSV interoperable: no contiene tipos de celda para Excel. */
export function csvPagos(
  pagos: ReadonlyArray<PagoV05>,
  options: { includeDecisionSignals?: boolean } = {},
): string {
  const table = csvPagosTable(pagos, options);
  return csv(table.headers, table.rows, table.dialect);
}
