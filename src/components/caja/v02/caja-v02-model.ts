/* V02 · Caja — el modelo PURO de la vista (rediseño Fase 2, issue #67).
 *
 * Contesta UNA pregunta: "¿me alcanza la caja?".
 *
 * Sin React a propósito, como `hoy-model.ts` (V01): cada cifra de esta pantalla es una
 * afirmación de plata y tiene que poder fijarse en un test sin montar un DOM.
 *
 * FUENTES (verificadas endpoint por endpoint contra `src/lib/api/types.ts`, generado del OpenAPI
 * vivo, 2026-08-30):
 *   · Hoy            → `cajaHoy()` sobre `GET /api/dashboard/summary` (Ley 1: la MISMA función que
 *                      V01; este módulo recibe el `CajaHoy` ya resuelto y NO desarma `cash_today`).
 *   · Entra 14d      → `GET /api/treasury/collection-forecast` (buckets 0-7 / 8-14, nominal y esperado).
 *   · Sale 14d       → `GET /api/treasury/accounts-payable` (`due_14d` del backend + ítems para lo
 *                      postergable, con la MISMA heurística que Pagar v2: `postergabilidadDe`).
 *   · Barras / piso  → `GET /api/treasury/cash-projection` (serie a cierre de día, `punto_quiebre`
 *                      con causas, `por_cobrar_vencido`, `calidad_fechas`, `fuentes`).
 *   · Deuda de datos → movimientos `unclassified` (`useUnclassifiedInRange`, por moneda: INV-FX-001).
 *
 * LO QUE NO EXISTE, dicho acá y no sólo en el PR: ningún endpoint edita la fecha estimada de un
 * pago que la proyección lea. `accounts-payable` es GET-only y los "términos de pago" del front
 * viven en `/api/me/preferences`, que el backend de `cash-projection` no consulta (buscado en
 * `qavante-api`: cero referencias a `terminos_pago`). Por eso "Postergar ▾" NO se construye como
 * acción muda: la tabla enlaza al pago en Pagar y el hueco queda declarado en la vista. */

import type {
  CashProjectionResponse,
  CollectionForecastResponse,
  UnclassifiedSummary,
} from "@/lib/api/treasury";
import type { AccountsPayableResponse, PayableItem } from "@/lib/api/pagos";
import type { CajaHoy } from "@/lib/finanzas/caja-hoy";
import { parseAmount, parseAmountOrNull } from "@/lib/formatters/amount";
import { formatClp } from "@/lib/formatters/clp";
import { formatPct } from "@/lib/formatters/pct";
import {
  formatDateLong,
  formatDateShort,
  formatHoraCorta,
  formatRelative,
} from "@/lib/formatters/date";
import { montoCLP, montoCLPFaltante } from "@/components/pagar/pagos-format";
import { daysUntilDue } from "@/components/pagar/pagos-v2-format";
import { postergabilidadDe } from "@/components/pagar/v2/pagar-v2-map";
import { entradasSinClasificarLabel } from "@/components/caja/v2/caja-v2-map";

/** Ventana de la tríada KPI (spec §V02: "Entra 14d / Sale 14d"). */
export const VENTANA_DIAS = 14;
/** Barras de la spec: "Próximas 4 semanas". */
export const SEMANAS = 4;

/* ── Fechas ISO (YYYY-MM-DD) sin pasar por `Date` local ───────────────────────── */

function utcDeISO(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Días civiles entre dos ISO (`b − a`). `null` si alguno no parsea. */
export function diasEntreISO(a: string, b: string): number | null {
  const ua = utcDeISO(a);
  const ub = utcDeISO(b);
  if (ua == null || ub == null) return null;
  return Math.round((ub - ua) / 86_400_000);
}

/** ISO + n días → ISO. */
export function sumarDiasISO(iso: string, n: number): string {
  const u = utcDeISO(iso);
  if (u == null) return iso;
  return new Date(u + n * 86_400_000).toISOString().slice(0, 10);
}

/* ── (1) Tríada KPI ──────────────────────────────────────────────────────────── */

export interface KpiHoyV02 {
  /** El saldo formateado, o `null` cuando NO SE SABE (nunca "$0" por un dato que no vino). */
  valor: string | null;
  /** Chip "BICE · 08:12 ✓" (spec §V02). `null` sin saldo. */
  chip: string | null;
  /** Apellido de la cifra (§1.4) o el motivo del "no sé". */
  detalle: string;
}

/** Nombre del banco para el chip: uno → su nombre; varios → "N bancos"; ninguno conocido → "Banco". */
export function nombreBancoChip(bancos: readonly string[]): string {
  const unicos = [...new Set(bancos.map((b) => b.trim()).filter(Boolean))];
  if (unicos.length === 1) return unicos[0]!;
  if (unicos.length > 1) return `${unicos.length} bancos`;
  return "Banco";
}

function mismoDiaLocal(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** KPI "Hoy". Recibe el `CajaHoy` YA resuelto por `cajaHoy()` — la fuente única de la Ley 1 —
 *  y no el summary: así este módulo no puede volver a desarmar `cash_today` por su cuenta. */
export function kpiHoy(caja: CajaHoy, bancos: readonly string[], hoy: Date): KpiHoyV02 {
  if (caja.monto == null) {
    return { valor: null, chip: null, detalle: "Conecta tu banco para ver tu saldo real" };
  }
  const banco = nombreBancoChip(bancos);
  let sello = "sin fecha";
  if (caja.actualizado) {
    const d = new Date(caja.actualizado);
    if (!Number.isNaN(d.getTime())) {
      sello = mismoDiaLocal(d, hoy) ? formatHoraCorta(d) : formatDateShort(d);
    }
  }
  /* El ✓ sólo cuando el backend declara el saldo `available`: un sello sobre un saldo viejo o
     estimado no es una verificación, es una fecha. */
  const ok = caja.estado === "available" && caja.actualizado != null;
  return {
    valor: formatClp(caja.monto),
    chip: `${banco} · ${sello}${ok ? " ✓" : ""}`,
    detalle:
      caja.estado === "stale"
        ? "Puede estar desactualizado · el mismo número que en Hoy"
        : caja.estado === "estimated"
          ? "Estimado · el mismo número que en Hoy"
          : "Saldo en tus cuentas · el mismo número que en Hoy",
  };
}

export interface Entra14V02 {
  /** Σ `expected` (ponderado por comportamiento de pago) de los buckets que caen en 14 días. */
  esperado: number;
  /** Σ `nominal` de esos mismos buckets. */
  nominal: number;
}

/** "Entra · 14 días" desde el forecast de cobranza. `null` = no vino el forecast (no se sabe). */
export function entra14d(f: CollectionForecastResponse | null | undefined): Entra14V02 | null {
  if (!f) return null;
  let esperado = 0;
  let nominal = 0;
  for (const b of f.buckets ?? []) {
    if (b.days_from < 0 || b.days_to > VENTANA_DIAS) continue;
    esperado += parseAmount(b.expected);
    nominal += parseAmount(b.nominal);
  }
  return { esperado, nominal };
}

export interface Sale14V02 {
  /** `due_14d` del backend (ya en CLP). */
  total: number;
  /** Σ de lo NEGOCIABLE que vence en 0..14 días (misma heurística que Pagar v2), en CLP. */
  postergable: number;
  /** Ítems en moneda extranjera SIN `amount_clp` dentro de la ventana: no se suman como pesos
   *  (INV-FX-001) y se declaran. */
  sinConvertir: number;
}

function dentroDeVentana(it: PayableItem, hoy: Date): boolean {
  const d = daysUntilDue(it.due_date, hoy);
  return d != null && d >= 0 && d <= VENTANA_DIAS;
}

/** "Sale · 14 días" con su postergable. `null` = no vino accounts-payable o no trae `due_14d`. */
export function sale14d(
  ap: AccountsPayableResponse | null | undefined,
  hoy: Date,
): Sale14V02 | null {
  if (!ap) return null;
  const total = parseAmountOrNull(ap.due_14d);
  if (total == null) return null;
  const items = (ap.items ?? []).filter((it) => dentroDeVentana(it, hoy));
  /* Ley 9: impuestos y sueldos jamás entran en postergaciones — `postergabilidadDe` ya los deja
     en `no_postergable`; acá sólo se suma lo `negociable`. */
  const postergable = items
    .filter((it) => postergabilidadDe(it) === "negociable")
    .reduce((s, it) => s + montoCLP(it), 0);
  const sinConvertir = items.filter(montoCLPFaltante).length;
  return { total, postergable, sinConvertir };
}

/* ── (3) Barras de 4 semanas + punto más bajo ─────────────────────────────────── */

interface PuntoSerie {
  dia: number;
  fecha: string;
  saldo: number;
}

/** La serie del backend como puntos {día, fecha, saldo}, con el día 0 = saldo de hoy. Ordenada.
 *  Vacía si no hay proyección o no trae serie (no se inventa una curva). */
export function puntosDeProyeccion(p: CashProjectionResponse | null | undefined): PuntoSerie[] {
  if (!p || !p.serie || p.serie.length === 0) return [];
  const out: PuntoSerie[] = [{ dia: 0, fecha: p.as_of, saldo: parseAmount(p.saldo_hoy) }];
  for (const s of p.serie) {
    const dia = diasEntreISO(p.as_of, s.fecha);
    if (dia == null || dia <= 0) continue;
    out.push({ dia, fecha: s.fecha, saldo: parseAmount(s.saldo_cierre) });
  }
  return out.sort((a, b) => a.dia - b.dia);
}

export interface PisoV02 {
  fecha: string;
  /** Fecha corta (§1.4): `24 ago`. */
  fechaLabel: string;
  saldo: number;
  dia: number;
  /** El ÚNICO candidato a rojo de la pantalla (Ley 2): el mínimo, y sólo si queda bajo cero. */
  bajoCero: boolean;
}

/** El punto más bajo de la proyección (primera ocurrencia del mínimo, incluido hoy). */
export function puntoMasBajo(p: CashProjectionResponse | null | undefined): PisoV02 | null {
  const puntos = puntosDeProyeccion(p);
  if (puntos.length === 0) return null;
  let min = puntos[0]!;
  for (const q of puntos) if (q.saldo < min.saldo) min = q;
  return {
    fecha: min.fecha,
    fechaLabel: formatDateShort(min.fecha),
    saldo: min.saldo,
    dia: min.dia,
    bajoCero: min.saldo < 0,
  };
}

export interface SemanaV02 {
  indice: number;
  /** `31 ago–6 sep` */
  label: string;
  /** Neto de la semana = cierre de la semana − cierre de la anterior (día 0 = saldo hoy). */
  neto: number;
  /** Saldo al cierre de la semana. */
  cierre: number;
  /** La semana que contiene el punto más bajo. */
  esPiso: boolean;
}

function cierreAlDia(puntos: PuntoSerie[], dia: number): number {
  let saldo = puntos[0]!.saldo;
  for (const q of puntos) {
    if (q.dia > dia) break;
    saldo = q.saldo;
  }
  return saldo;
}

/** Las próximas N semanas (default 4) derivadas de la serie diaria del backend. Vacío sin serie. */
export function semanas(p: CashProjectionResponse | null | undefined, n = SEMANAS): SemanaV02[] {
  const puntos = puntosDeProyeccion(p);
  if (puntos.length === 0 || !p) return [];
  const piso = puntoMasBajo(p);
  const out: SemanaV02[] = [];
  for (let k = 0; k < n; k += 1) {
    const desde = 7 * k;
    const hasta = 7 * (k + 1);
    const cierrePrev = cierreAlDia(puntos, desde);
    const cierre = cierreAlDia(puntos, hasta);
    const ini = sumarDiasISO(p.as_of, desde + 1);
    const fin = sumarDiasISO(p.as_of, hasta);
    /* El día 0 (hoy) pertenece a la primera semana: si el saldo de hoy YA es el mínimo, la
       primera barra es la que lo carga. */
    const esPiso =
      piso != null && (k === 0 ? piso.dia <= hasta : piso.dia > desde && piso.dia <= hasta);
    out.push({
      indice: k,
      label: `${formatDateShort(ini)}–${formatDateShort(fin)}`,
      neto: cierre - cierrePrev,
      cierre,
      esPiso,
    });
  }
  return out;
}

/* ── (4) Qué te lleva al punto más bajo ───────────────────────────────────────── */

export type TipoCausaV02 = "pago" | "impuesto" | "vencido" | "otro";

export interface CausaV02 {
  glosa: string;
  fechaLabel: string;
  /** Monto FIRMADO (negativo = egreso), como lo manda el backend. */
  monto: number;
  tipo: TipoCausaV02;
  /** Ley 9: impuestos y sueldos jamás se postergan. El resto NO se sabe: el backend no manda
   *  postergabilidad por causa, y no se inventa. */
  postergable: "no" | "desconocido";
}

function tipoCausa(t: string | null | undefined): TipoCausaV02 {
  if (t === "f29") return "impuesto";
  if (t === "pago_vencido") return "vencido";
  if (t === "pago") return "pago";
  return "otro";
}

/** Las causas del punto de quiebre del backend (los mayores egresos hasta cruzar el mínimo),
 *  ordenadas del más grande al más chico. Vacío si no hay quiebre. */
export function causasDelPiso(p: CashProjectionResponse | null | undefined): CausaV02[] {
  const causas = p?.punto_quiebre?.causas ?? [];
  return causas
    .map((c) => {
      const tipo = tipoCausa(c.tipo);
      return {
        glosa: c.glosa,
        fechaLabel: formatDateShort(c.fecha ?? p?.punto_quiebre?.fecha ?? null),
        monto: parseAmount(c.monto),
        tipo,
        postergable: tipo === "impuesto" ? ("no" as const) : ("desconocido" as const),
      };
    })
    .sort((a, b) => a.monto - b.monto);
}

/** Fecha corta del quiebre (primer día bajo el mínimo), o `null` si la caja no cruza el mínimo. */
export function fechaQuiebre(p: CashProjectionResponse | null | undefined): string | null {
  const f = p?.punto_quiebre?.fecha;
  return f ? formatDateShort(f) : null;
}

/* ── (5) Footer: exclusiones del cálculo ──────────────────────────────────────── */

/** Lo que la proyección deja AFUERA, con conteo. Sólo lo que el backend declara. */
export function exclusiones(p: CashProjectionResponse | null | undefined): string[] {
  if (!p) return [];
  const out: string[] = [];
  const pcv = p.por_cobrar_vencido;
  if (pcv && pcv.n > 0) {
    const total = parseAmount(pcv.total);
    out.push(
      `No cuenta ${formatClp(total)} por cobrar vencidos o sin fecha (${pcv.n} ${
        pcv.n === 1 ? "documento" : "documentos"
      })`,
    );
  }
  const cf = p.fuentes?.calidad_fechas;
  if (cf && cf.items_totales > 0) {
    const pct = formatPct(Math.round(cf.con_fecha_real * 100));
    const estimadas = cf.items_totales - Math.round(cf.con_fecha_real * cf.items_totales);
    if (estimadas > 0) {
      out.push(
        `${estimadas} de ${cf.items_totales} obligaciones van con fecha estimada, no real (${pct} con fecha real)`,
      );
    }
  }
  return out;
}

/* ── (2) Banner: deuda de datos ───────────────────────────────────────────────── */

export interface DeudaDatosV02 {
  count: number;
  /** "$61.500.000 · US$ 1.200,00" — un monto POR MONEDA, nunca una suma mezclada. `null` sin entradas. */
  entradasLabel: string | null;
  /** Entradas cuya moneda no se conoce: no están en ningún total. */
  entradasSinMoneda: number;
}

/** `null` cuando no hay nada sin clasificar (el banner no se muestra) o mientras carga. */
export function deudaDeDatos(sc: UnclassifiedSummary | null | undefined): DeudaDatosV02 | null {
  if (!sc || sc.isLoading || sc.count <= 0) return null;
  return {
    count: sc.count,
    entradasLabel: entradasSinClasificarLabel(sc),
    entradasSinMoneda: sc.unknownInflowCount,
  };
}

/* ── "¿Cómo se calcula?" (§1.4: definición, incluye/excluye, fuente y frescura) ── */

export interface ComoSeCalculaV02 {
  definicion: string;
  incluye: string[];
  excluye: string[];
  fuente: string;
  frescura: string;
}

/** El contenido del popover. Sólo afirma lo que el contrato del endpoint declara. */
export function comoSeCalcula(
  p: CashProjectionResponse | null | undefined,
  hoy: Date,
): ComoSeCalculaV02 {
  const excluye = exclusiones(p);
  const partes: string[] = [];
  if (p?.as_of) partes.push(`calculado el ${formatDateLong(p.as_of)}`);
  const sync = p?.fuentes?.saldo_synced_at;
  if (sync) partes.push(`saldo del banco sincronizado ${formatRelative(sync, hoy)}`);
  return {
    definicion:
      "Saldo proyectado al cierre de cada día: parte del saldo real del banco de hoy y le suma los cobros esperados y le resta los pagos comprometidos.",
    incluye: [
      "Saldo bancario real de hoy (todos los movimientos, clasificados o no)",
      "Cobros esperados con fecha, según el comportamiento de pago de cada cliente",
      "Pagos comprometidos: proveedores, obligaciones y F29",
    ],
    excluye:
      excluye.length > 0 ? excluye : ["La proyección no declara exclusiones para tu empresa"],
    fuente: "GET /api/treasury/cash-projection (una sola proyección para toda la app)",
    frescura: partes.length > 0 ? partes.join(" · ") : "Sin sello de frescura",
  };
}
