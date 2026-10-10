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
 * POSTERGAR (#80): `Causa.payable_id` identifica el pago de forma inequívoca y se manda a
 * `POST /api/treasury/accounts-payable/{payable_id}/postpone`. Jamás se infiere identidad desde
 * glosa, monto o fecha. Sin UUID no hay acción; impuestos y remuneraciones se excluyen también
 * en la UI, y el backend vuelve a validar estructuralmente la Ley 9. */

import type {
  CashProjectionResponse,
  CollectionForecastResponse,
  UnclassifiedSummary,
} from "@/lib/api/treasury";
import type { AccountsPayableResponse } from "@/lib/api/pagos";
import type { CajaHoy } from "@/lib/finanzas/caja-hoy";
import { importeDesconocido, parseAmount, parseAmountOrNull } from "@/lib/formatters/amount";
import { formatClp } from "@/lib/formatters/clp";
import { concordar } from "@/lib/formatters/count";
import { formatPct } from "@/lib/formatters/pct";
import {
  formatDateLong,
  formatDateShort,
  formatHoraCorta,
  formatRelative,
} from "@/lib/formatters/date";
import {
  entradasSinClasificarLabel,
  salidasSinClasificarLabel,
} from "@/components/caja/v2/caja-v2-map";

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
  /** Σ `expected` (ponderado por comportamiento de pago) de los buckets que caen en 14 días.
   *  `null` = en revisión de conciliación (qavante-api#907). */
  esperado: number | null;
  /** Σ `nominal` de esos mismos buckets. `null` = en revisión. */
  nominal: number | null;
  /** Cuarentena de conciliación viva: lo que entra es DESCONOCIDO, no cero. */
  enRevision: boolean;
}

/** "Entra · 14 días" desde el forecast de cobranza. `null` = no vino el forecast (no se sabe). */
export function entra14d(f: CollectionForecastResponse | null | undefined): Entra14V02 | null {
  if (!f) return null;
  const enVentana = (f.buckets ?? []).filter((b) => b.days_from >= 0 && b.days_to <= VENTANA_DIAS);
  // #907: un bucket con monto `null` (o el forecast marcado) vuelve desconocida la suma entera.
  if (importeDesconocido(f) || enVentana.some((b) => b.expected == null || b.nominal == null)) {
    return { esperado: null, nominal: null, enRevision: true };
  }
  let esperado = 0;
  let nominal = 0;
  for (const b of enVentana) {
    esperado += parseAmount(b.expected);
    nominal += parseAmount(b.nominal);
  }
  return { esperado, nominal, enRevision: false };
}

export interface NoPostergable14V02 {
  /** `amount_clp` cuando el agregado está completo; `null` = subtotal no disponible. */
  monto: number | null;
  /** Parte conocida en CLP: un piso ("al menos") cuando `completo` es false. `null` = en
   *  revisión de conciliación (#907): no hay parte conocida. */
  conocido: number | null;
  /** Cantidad conocida de obligaciones del agregado. */
  n: number;
  completo: boolean;
  /** Obligaciones sin vencimiento confirmado que podrían pertenecer a la ventana. */
  fechasDesconocidas: number;
  /** Buckets de moneda sin tipo de cambio; nunca se interpreta como cantidad de pagos. */
  monedasExcluidas: number;
}

export interface Sale14V02 {
  /** `due_14d` del backend (ya en CLP). `null` = en revisión de conciliación (#907). */
  total: number | null;
  /** Cuarentena AP viva: lo que sale es DESCONOCIDO, no cero ni "no vino". */
  enRevision: boolean;
  /** `non_postponable_or_overdue_14d` del backend: lo que YA venció más lo que vence en 14 días y
   *  no se posterga (Ley 9 ejecutable: impuestos, sueldos, deuda). Es el MISMO agregado que V05
   *  publica como "Pagos críticos en todo el registro" (Ley 1). `null` cuando el contrato no lo
   *  trajo: la pantalla lo declara, no lo aproxima desde `items`. */
  noPostergable: NoPostergable14V02 | null;
}

/** "Sale · 14 días" con su parte no postergable. `null` = no vino accounts-payable o no trae
 *  `due_14d`.
 *
 *  Antes esta función sumaba localmente lo "negociable" (`postergabilidadDe` sobre `items`, una
 *  lista topeada por `limit`). El contrato no publica un agregado "negociable"; publica su
 *  complemento (`non_postponable_or_overdue_14d`), y ése es el que se consume. La resta
 *  `due_14d − no postergable` NO se hace acá: sería reconstruir una cifra que el servidor no
 *  afirma (#302 P2-6). */
export function sale14d(
  ap: AccountsPayableResponse | null | undefined,
  /** Ya no se usa: nada depende del reloj. Se conserva en la firma porque
   *  `pagar-v05-model.test.ts` (rama de #315) todavía pasa la fecha; se retira cuando #315 entre. */
  hoy?: Date,
): Sale14V02 | null {
  void hoy;
  if (!ap) return null;
  if (importeDesconocido(ap)) return { total: null, enRevision: true, noPostergable: null };
  const total = parseAmountOrNull(ap.due_14d);
  if (total == null) return null;
  const summary = ap.non_postponable_or_overdue_14d;
  const noPostergable: NoPostergable14V02 | null = summary
    ? {
        monto: summary.complete ? parseAmountOrNull(summary.amount_clp) : null,
        conocido: parseAmountOrNull(summary.known_amount_clp),
        n: summary.count,
        completo: summary.complete === true,
        fechasDesconocidas: summary.unknown_due_date_count,
        monedasExcluidas: summary.excluded_by_currency.length,
      }
    : null;
  return { total, enRevision: false, noPostergable };
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
  /**
   * Día relativo a `as_of`, SÓLO para colocar el piso en una barra. No decide nada.
   * `null` si la fecha del piso no se puede ubicar contra `as_of`: entonces NINGUNA barra se
   * marca, en vez de marcar la primera. Un día que no se pudo calcular no es el día 0.
   */
  dia: number | null;
  /**
   * El ÚNICO candidato a rojo de la pantalla (Ley 2). Lo publica el servidor comparando el piso
   * contra la caja mínima declarada: el front no vuelve a decidir el umbral.
   */
  bajoMinimo: boolean;
  /** La caja mínima contra la que el servidor comparó. */
  minimo: number;
  /** Cuánto falta para no bajar del mínimo ese día; 0 si alcanza. */
  brecha: number;
  /**
   * Deuda ya vencida que este piso NO incluye (magnitud positiva). `null` si el productor no la
   * publicó: ausente NO es cero, porque cero significa que se midió y no hay deuda vencida.
   */
  vencidoExigibleExcluido: number | null;
  /** Ventana que el servidor miró para encontrar el piso. */
  horizonteDias: number;
}

/* EL PUNTO MÁS BAJO LO DEFINE EL SERVIDOR, Y ESTA PANTALLA SÓLO LO COLOCA EN UNA BARRA.
   Acá vivía un recorrido de la serie que elegía el mínimo por su cuenta y lo pintaba rojo con
   `saldo < 0`. Eran DOS divergencias contra el productor canónico (`punto_mas_bajo`,
   qavante-api#1050), no una:

   1. EL UMBRAL. El servidor compara el piso contra la caja mínima declarada y publica
      `bajo_minimo`; el front comparaba contra CERO. Con un mínimo declarado > 0, todo piso que
      cae entre cero y el mínimo se pintaba neutro — la caja bajo el umbral, en verde. Y en la
      misma sección el copy ya decía "antes de quedar bajo el mínimo" leyendo `punto_quiebre` del
      servidor: dos definiciones del MISMO umbral, a dos líneas de distancia.
   2. EL UNIVERSO. El piso del servidor se mide sobre `horizon_days` y, desde la decisión del BO
      del 2026-10-04, NO coloca lo vencido exigible en ningún día de la curva. El mínimo que
      elegía el front salía de los puntos que esta pantalla tenía a mano. Dos universos, un
      nombre.

   Ahora `punto_mas_bajo` llega leído y `dia` existe sólo para que `semanas()` sepa en qué barra
   cae: es estructuralmente incapaz de decidir si el piso está bajo el mínimo, porque ya no
   recibe ni el mínimo ni la serie. */
export function puntoMasBajo(p: CashProjectionResponse | null | undefined): PisoV02 | null {
  const pm = p?.punto_mas_bajo;
  if (!p || !pm) return null;
  return {
    fecha: pm.fecha,
    fechaLabel: formatDateShort(pm.fecha),
    saldo: parseAmount(pm.saldo),
    dia: diasEntreISO(p.as_of, pm.fecha),
    bajoMinimo: pm.bajo_minimo,
    minimo: parseAmount(pm.minimo),
    brecha: parseAmount(pm.brecha),
    vencidoExigibleExcluido: parseAmountOrNull(pm.vencido_exigible_excluido),
    horizonteDias: pm.horizon_days,
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
    /* Sin día ubicable no se marca ninguna barra: marcar la primera sería inventar que el
       piso cae hoy. */
    const pisoDia = piso?.dia ?? null;
    const esPiso =
      pisoDia != null && (k === 0 ? pisoDia <= hasta : pisoDia > desde && pisoDia <= hasta);
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
  /** UUID entregado por el backend. Ausente = no se ofrece Postergar. */
  payableId: string | null;
  /** Ley 9: impuestos y remuneraciones nunca se postergan. */
  postergable: "si" | "no" | "sin_identidad";
}

function tipoCausa(t: string | null | undefined): TipoCausaV02 {
  if (t === "f29") return "impuesto";
  if (t === "pago_vencido") return "vencido";
  if (t === "pago") return "pago";
  return "otro";
}

/** Exclusión conservadora de remuneraciones conocidas; el backend vuelve a validar Ley 9. */
function esRemuneracion(glosa: string): boolean {
  return /remuneraci[oó]n|sueldo|n[oó]mina|planilla/i.test(glosa);
}

/** Las causas del punto de quiebre del backend (los mayores egresos hasta cruzar el mínimo),
 *  ordenadas del más grande al más chico. Vacío si no hay quiebre. */
export interface CausasDelPisoOptions {
  /** El detalle normal destaca los montos mayores; el Brief conserva la secuencia publicada. */
  order?: "amount" | "source";
  /** No inferir si un pago se puede postergar cuando el Brief canónico está visible. */
  includePostergabilidad?: boolean;
}

export function causasDelPiso(
  p: CashProjectionResponse | null | undefined,
  { order = "amount", includePostergabilidad = true }: CausasDelPisoOptions = {},
): CausaV02[] {
  const causas = p?.punto_quiebre?.causas ?? [];
  const filas = causas.map((c) => {
    const tipo = tipoCausa(c.tipo);
    const payableId = c.payable_id ?? null;
    const postergable = !includePostergabilidad
      ? ("sin_identidad" as const)
      : tipo === "impuesto" || esRemuneracion(c.glosa)
        ? ("no" as const)
        : payableId
          ? ("si" as const)
          : ("sin_identidad" as const);
    return {
      glosa: c.glosa,
      fechaLabel: formatDateShort(c.fecha ?? p?.punto_quiebre?.fecha ?? null),
      monto: parseAmount(c.monto),
      tipo,
      payableId,
      postergable,
    };
  });
  return order === "source" ? filas : filas.sort((a, b) => a.monto - b.monto);
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
  /* LO QUE LA CURVA DEJA AFUERA LO DECLARA `fuentes.cobertura`, Y HASTA ACÁ NADIE LO LEÍA.
     El docstring de esta función ya prometía "sólo lo que el backend declara", pero leía
     `por_cobrar_vencido` y `calidad_fechas` y se saltaba el bloque que el productor escribió
     justamente para esto. Cada clave de abajo es un monto o un conteo que NO está en el piso: sin
     nombrarlas, el piso se lee como si cubriera todo. Una ausencia no se traduce a cero. */
  const cob = p.fuentes?.cobertura;
  if (cob) {
    /* El caso más caro: el monto es DESCONOCIDO, así que no hay cifra que mostrar al lado. Lo
       único honesto es nombrar la obligación que falta y cómo se repara. */
    if (cob.f29_legacy_unattributed) {
      out.push(
        "No cuenta el F29 pendiente que cuelga de un F29 histórico sin sociedad: su monto no entra a la curva, ni como cero ni como estimado. Se repara re-sincronizando el F29 bajo la sociedad",
      );
    }
    if (cob.f29_omitido_por_moneda) {
      out.push(
        "No cuenta el F29, porque la moneda funcional de la sociedad no es el peso chileno y no se proyectó",
      );
    }
    const docsOtraMoneda = parseAmountOrNull(cob.moneda_distinta_excluidos);
    if (docsOtraMoneda != null && docsOtraMoneda > 0) {
      out.push(
        `No cuenta ${docsOtraMoneda} ${concordar(docsOtraMoneda, "documento vivo", "documentos vivos")} en una moneda distinta de la funcional`,
      );
    }
    /* Conteo aparte del de arriba a propósito: las cuotas viven en otra tabla que el universo
       AP/AR, y sumarlas haría incomparable el contador con el de la otra superficie de Caja. */
    const cuotasOtraMoneda = parseAmountOrNull(cob.moneda_distinta_cuotas_excluidas);
    if (cuotasOtraMoneda != null && cuotasOtraMoneda > 0) {
      out.push(
        `No cuenta ${cuotasOtraMoneda} ${concordar(cuotasOtraMoneda, "cuota", "cuotas")} de tarjeta o préstamo en una moneda distinta de la funcional`,
      );
    }
  }
  const cf = p.fuentes?.calidad_fechas;
  if (cf && cf.items_totales > 0) {
    const pct = formatPct(Math.round(cf.con_fecha_real * 100));
    const estimadas = cf.items_totales - Math.round(cf.con_fecha_real * cf.items_totales);
    if (estimadas > 0) {
      out.push(
        `${estimadas} de ${cf.items_totales} ${concordar(
          estimadas,
          "obligación va",
          "obligaciones van",
        )} con fecha estimada, no real (${pct} con fecha real)`,
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
  /** El gemelo de `entradasLabel` para salidas. B11 (QA real, 2026-10-10): el aviso sólo nombraba
   *  las entradas aunque hubiera salidas pendientes en el mismo lote de `count` ("11 movimientos
   *  pendientes (~$38.512.299 en entradas)" callaba 3 salidas por $313.040). `null` sin salidas. */
  salidasLabel: string | null;
  /** Salidas cuya moneda no se conoce: no están en ningún total. */
  salidasSinMoneda: number;
  /** La consulta de sin-clasificar FALLÓ: `count` no es un cero real, es "no lo sabemos" (Ley 8).
   *  Cuando es `true`, el resto de los campos no se usan (banner de error). */
  error: boolean;
}

/** `null` cuando no hay nada sin clasificar (el banner no se muestra) o mientras carga.
 *  Con error, el banner SÍ se muestra (con `error: true`): un `count` en 0 por una consulta
 *  fallida no es "todo clasificado", y el "no sé" no puede desaparecer en silencio (Ley 8). */
export function deudaDeDatos(sc: UnclassifiedSummary | null | undefined): DeudaDatosV02 | null {
  if (!sc || sc.isLoading) return null;
  if (sc.isError) {
    return {
      count: 0,
      entradasLabel: null,
      entradasSinMoneda: 0,
      salidasLabel: null,
      salidasSinMoneda: 0,
      error: true,
    };
  }
  if (sc.count <= 0) return null;
  return {
    count: sc.count,
    entradasLabel: entradasSinClasificarLabel(sc),
    entradasSinMoneda: sc.unknownInflowCount,
    salidasLabel: salidasSinClasificarLabel(sc),
    salidasSinMoneda: sc.unknownOutflowCount,
    error: false,
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
      "Saldo proyectado al cierre de cada día: parte del saldo bancario disponible informado para hoy, suma los cobros esperados y resta los pagos comprometidos.",
    incluye: [
      "Saldo bancario disponible informado para hoy (con movimientos clasificados y sin clasificar)",
      "Cobros esperados con fecha, según el comportamiento de pago de cada cliente",
      "Pagos comprometidos: proveedores, obligaciones y F29",
    ],
    /* Sin proyección no hay NADA que declarar (ni "sí" ni "no"): "no declara exclusiones" es una
       afirmación sobre un cálculo que no corrió. Con proyección y sin exclusiones, en cambio, SÍ
       hay algo que afirmar: el backend corrió y no declaró ninguna. */
    excluye:
      excluye.length > 0
        ? excluye
        : p
          ? ["La proyección no declara exclusiones para tu empresa"]
          : ["Sin proyección no hay exclusiones que declarar"],
    fuente: "Saldos bancarios, cobros con fecha y pagos comprometidos registrados en Qavante",
    /* "no disponible" es una etiqueta de confianza sobre un hueco: no dice qué falta. Lo que
       falta acá tiene nombre: la respuesta no trajo `as_of` ni `saldo_synced_at`. */
    frescura: partes.length > 0 ? partes.join(" · ") : "La proyección no informó cuándo se calculó",
  };
}
