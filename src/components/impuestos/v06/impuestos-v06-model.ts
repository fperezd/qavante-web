/* V06 · Impuestos — modelo PURO (issue tooxs-digital/qavante-web#73, ESPECIFICACION §V06). Sin
 * React, como `presupuesto-v09-model.ts` / `gestion-v08-model.ts`: cada cifra de la tríada y cada
 * fila del calendario tributario se fija en un test sin montar un DOM.
 *
 * Contesta UNA pregunta: "¿qué impuestos vencen, y cuáles ya declaraste?"
 *
 * ── FUENTES VERIFICADAS (issue #73, medición contra el tenant productivo, comentario 2026-08-31) ─
 * `GET /api/treasury/tax-calendar` EXISTE pero vuelve VACÍO en producción (`total: "0"`, `events:
 * []`) — `GET /api/treasury/obligations` sólo trae `card_purchase`, ninguna obligación tributaria
 * por esa vía. Este módulo NO se construye sobre ninguno de los dos: la fuente real es
 *   · `GET /api/sii/f29/estado?anio=` (`useSiiF29Estado`, YA vivo, lo consume `f29-panel-view.tsx`)
 *     — 12 meses por año con `estado/declarado/folio/saldo/vencimiento/postergado_iva/
 *     monto_postergado/vencimiento_postergado`. Es el calendario de F-29 completo, declarado o no.
 *   · `GET /api/tgr/health` + `/movimientos-deudas` (`useTgrHealth`/`useTgrMovimientosDeudas`, YA
 *     vivo, lo consume `deudas-tgr-view.tsx`) — HOY `authenticated` es `false` para todo tenant (el
 *     backend alimenta TGR desde un helper LOCAL, escalado api#758): este módulo degrada igual de
 *     honesto que esa vista ("TGR: en preparación"), nunca inventa una deuda ni un cero.
 *   · `GET /api/buk/payroll` (`useBukPayroll`, YA vivo, lo consume `previred-view.tsx` y V16) — el
 *     monto de Previred es `totales.total_cotizaciones` de la MISMA fuente que ya muestra "Previred"
 *     en Pagar y "Cotizaciones" en V16 (Ley 1). El vencimiento es `vencimientoPrevired()` (día 13
 *     del mes siguiente), reusada TAL CUAL de `pagar/previred-vencimiento.ts` — no una segunda
 *     fórmula que podría desincronizarse de la que ya está en pantalla.
 *
 * ── ESTIMACIÓN R2 (qavante-api #401) ─────────────────────────────────────────────────────────────
 * `GET /api/sii/f29/impuesto` publica el cálculo canónico, su desglose, `estimable`, insumos
 * faltantes y frescura. Este módulo no recalcula nada: `estimacionF29V06` sólo deja pasar el monto
 * cuando `estimable === true` y el desglose material está completo. Con false, null o una respuesta
 * inconsistente conserva "sin dato" y explica los insumos faltantes; nunca sustituye ausencia por 0.
 *
 * ── SEGUNDO HUECO, no pedido por el issue pero verificado contra el contrato: "conciliado con
 * cargo bancario" ──────────────────────────────────────────────────────────────────────────────
 * La espec también pide que la fila "F-29 pagado" quede "conciliado con cargo banco ✓ → link
 * comprobante". `PayableItem` (accounts-payable) no trae ningún campo que ligue un F-29 declarado a
 * UN movimiento bancario específico (verificado contra `src/lib/api/types.ts`: ni `movement_id` ni
 * equivalente), y el motor de conciliación (`reconciliation.ts`) matchea documentos de venta/compra,
 * no obligaciones tributarias. Inventar el vínculo con una heurística de fecha+categoría sería
 * exactamente el tipo de "sugerencia sin evidencia dura" que la Ley 3 prohíbe (la regla de
 * duplicados de Pagar V05 exige RUT+monto±1%, no una coincidencia de mes). Por eso las filas
 * declaradas quedan como "Declarado" (hecho verificado por el SII) y el "comprobante" enlaza al F-29
 * real del SII (vía `/pagar/impuestos/f29`, que ya resuelve el PDF con su manejo de carga —
 * `f29-month-detail.tsx` — sin duplicar esa lógica acá); la conciliación bancaria queda declarada
 * como hueco, no inferida.
 *
 * ── IVA POSTERGADO: se MUESTRA, no se OFRECE (Ley 9 / QA §5.10) ──────────────────────────────────
 * Cuando el SII declara la postergación oficial del IVA (código 755, `postergado_iva: true`), el
 * vencimiento se corre dos meses y el monto se debe APARTE — un vencimiento real que el usuario
 * necesita ver. La Ley 9 prohíbe que QAVANTE ofrezca postergar impuestos; no prohíbe reportar que el
 * SII ya lo hizo. `filaF29PostergadoDeMes` agrega una fila SEPARADA, sin ningún botón de acción,
 * cuyo `sub` aclara que es una postergación del SII, no de Qavante. */

import type { F29EstadoMes, F29ImpuestoResponse } from "@/lib/api/sii";
import type { TgrMovimiento } from "@/lib/api/tgr";
import { diasHasta, venceLabelDe } from "@/components/pagar/v05/pagar-v05-model";
import { vencimientoPrevired } from "@/components/pagar/previred-vencimiento";
import { formularioLabelTgr } from "@/components/pagar/tgr-format";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { formatRelative } from "@/lib/formatters/date";
import { concordar } from "@/lib/formatters/count";
export { concordar };

/* ── Texto fijo de la Ley 9 (issue #73, footer literal) ──────────────────────────────────────── */
export const LEY_9_TEXTO_V06 = "Las obligaciones tributarias nunca se postergan desde Qavante";

/* ── Estimación F-29 canónica (API #401) ─────────────────────────────────────────────────────── */
export const F29_ESTIMADO_MOTIVO =
  "El servicio no publicó una estimación afirmable para este período. No sustituimos insumos ausentes por cero.";

export function f29EstimadoHuecoV06(): { reason: string } {
  return { reason: F29_ESTIMADO_MOTIVO };
}

const INPUT_FALTANTE_LABEL: Readonly<Record<string, string>> = {
  remanente: "remanente de crédito fiscal",
  impuesto_trabajadores: "impuesto de trabajadores",
  rcv_incompleto: "RCV completo del período",
};

const PROCEDENCIA_LABEL: Readonly<Record<string, string>> = {
  rcv: "RCV",
  f29_oficial: "F-29 oficial",
  buk_cache: "BUK sincronizado",
  buk_live: "BUK",
  manual: "Dato manual",
  unavailable: "Fuente no disponible",
};

const FRESCURA_LABEL: Readonly<Record<string, string>> = {
  fresh: "al día",
  stale: "desactualizada",
  unknown: "frescura desconocida",
  not_used: "no usada",
};

export interface FuenteEstimacionF29V06 {
  key: string;
  label: string;
  frescura: string;
  sincronizadaEn: string | null;
}

export interface DesgloseEstimacionF29V06 {
  ivaDebito: number;
  ivaCredito: number;
  remanente: number;
  ppm: number;
  impuestoTrabajadores: number;
}

export interface EstimacionF29V06 {
  periodo: string | null;
  monto: number | null;
  motivoSinMonto: string | null;
  faltantes: string[];
  desglose: DesgloseEstimacionF29V06 | null;
  evaluadaEn: string | null;
  fuentes: FuenteEstimacionF29V06[];
}

function faltantesLegibles(inputs: readonly string[]): string[] {
  return inputs.map((input) => INPUT_FALTANTE_LABEL[input] ?? input.replaceAll("_", " "));
}

function fuentesEstimacionF29V06(
  sources: F29ImpuestoResponse["input_sources"],
): FuenteEstimacionF29V06[] {
  return Object.entries(sources ?? {}).map(([key, source]) => ({
    key,
    label: PROCEDENCIA_LABEL[source.provenance] ?? source.source,
    frescura: FRESCURA_LABEL[source.freshness] ?? source.freshness,
    sincronizadaEn: source.last_synced_at ?? null,
  }));
}

/**
 * Adapta el contrato R2 sin recalcular impuestos. El monto sólo cruza al modelo visible cuando
 * `estimable=true`, `incompleto` no está marcado, no hay `missing_inputs` y todos los campos del
 * desglose que explican el total vienen publicados.
 */
export function estimacionF29V06(
  data: F29ImpuestoResponse | null | undefined,
  motivoConsulta?: string | null,
): EstimacionF29V06 {
  if (!data) {
    return {
      periodo: null,
      monto: null,
      motivoSinMonto: motivoConsulta ?? F29_ESTIMADO_MOTIVO,
      faltantes: [],
      desglose: null,
      evaluadaEn: null,
      fuentes: [],
    };
  }

  const faltantes = faltantesLegibles(data.missing_inputs ?? []);
  const fuentes = fuentesEstimacionF29V06(data.input_sources);
  if (data.estimable !== true || data.incompleto === true || faltantes.length > 0) {
    return {
      periodo: data.periodo,
      monto: null,
      motivoSinMonto:
        faltantes.length > 0
          ? `Faltan insumos para estimar: ${faltantes.join(", ")}.`
          : data.incompleto === true
            ? "El servicio publicó la evaluación como incompleta. No mostramos un monto tributario."
            : F29_ESTIMADO_MOTIVO,
      faltantes,
      desglose: null,
      evaluadaEn: data.as_of,
      fuentes,
    };
  }

  const campos = [
    data.total_con_iva,
    data.iva_debito,
    data.iva_credito,
    data.remanente,
    data.ppm,
    data.impuesto_trabajadores,
  ];
  if (campos.some((value) => value == null)) {
    return {
      periodo: data.periodo,
      monto: null,
      motivoSinMonto:
        "El servicio marcó la estimación como disponible, pero no publicó todos los montos del desglose.",
      faltantes,
      desglose: null,
      evaluadaEn: data.as_of,
      fuentes,
    };
  }

  return {
    periodo: data.periodo,
    monto: data.total_con_iva!,
    motivoSinMonto: null,
    faltantes,
    desglose: {
      ivaDebito: data.iva_debito!,
      ivaCredito: data.iva_credito!,
      remanente: data.remanente!,
      ppm: data.ppm!,
      impuestoTrabajadores: data.impuesto_trabajadores!,
    },
    evaluadaEn: data.as_of,
    fuentes,
  };
}

export const TGR_EN_PREPARACION_MOTIVO =
  "TGR: en preparación. Conectamos la Tesorería server-side; hasta entonces no leemos tus deudas fiscales desde acá (mismo estado honesto que Pagar → Impuestos → Deudas TGR).";

/* ── Ventana de periodos del calendario (últimos N meses, incluido el actual) ────────────────── */

/** Los últimos `cantidadMeses` períodos `YYYY-MM`, ascendente, terminando en el mes de `hoy`
 *  (America/Santiago la resuelve el caller — acá `hoy` ya viene con el mes correcto). PURA. */
export function ventanaPeriodosV06(hoy: Date, cantidadMeses = 6): string[] {
  const out: string[] = [];
  let y = hoy.getFullYear();
  let m = hoy.getMonth() + 1; // 1-12
  for (let i = 0; i < cantidadMeses; i += 1) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/* ── La fila del calendario ───────────────────────────────────────────────────────────────────── */

export type ConceptoV06 = "f29" | "f29_postergado" | "previred" | "tgr";

export type EstadoFilaV06 =
  | "declarado"
  | "por_declarar"
  | "no_declarado_vencido"
  | "en_curso"
  | "sin_dato"
  | "iva_postergado"
  | "previred_programado"
  | "tgr_deuda"
  | "tgr_sin_deuda";

export const ESTADO_LABEL_V06: Record<EstadoFilaV06, string> = {
  declarado: "Declarado",
  por_declarar: "Por declarar",
  no_declarado_vencido: "No declarado (vencido)",
  en_curso: "En curso",
  sin_dato: "Sin dato",
  iva_postergado: "IVA postergado (SII)",
  previred_programado: "Programado",
  tgr_deuda: "Deuda",
  tgr_sin_deuda: "Sin deuda",
};

/** Tono BASE por estado (Pill). `no_declarado_vencido` escala a "bad" SOLO para la fila que elige
 *  `elUnicoRojoV06` (Ley 2: máximo un rojo por pantalla) — acá queda en "warn" para el resto. */
export const ESTADO_TONO_V06: Record<EstadoFilaV06, "ok" | "warn" | "mut"> = {
  declarado: "ok",
  por_declarar: "mut",
  no_declarado_vencido: "warn",
  en_curso: "mut",
  sin_dato: "mut",
  iva_postergado: "warn",
  previred_programado: "mut",
  tgr_deuda: "warn",
  tgr_sin_deuda: "ok",
};

export interface FilaCalendarioV06 {
  key: string;
  concepto: ConceptoV06;
  label: string;
  sub: string;
  estado: EstadoFilaV06;
  vencimiento: string | null;
  vencimientoLabel: string;
  dias: number | null;
  monto: number | null;
  /** Moneda ISO-4217 del monto. `null` = la fuente no la informó; nunca se interpreta como CLP. */
  moneda: string | null;
  /** Por qué `monto` es `null` — NUNCA vacío cuando `monto` lo es (Ley 3, "no sé" explícito). */
  motivoSinMonto: string | null;
  /** Ya pasó / ya se resolvió (declarado, sin deuda) — ordena después de lo pendiente. */
  resuelto: boolean;
  href: string | null;
  hrefLabel: string | null;
}

/* ── F-29 ──────────────────────────────────────────────────────────────────────────────────────── */

const ESTADO_F29_MAP: Record<F29EstadoMes["estado"], EstadoFilaV06> = {
  declarado: "declarado",
  sin_dato: "sin_dato",
  no_declarado_vencido: "no_declarado_vencido",
  por_declarar: "por_declarar",
  en_curso: "en_curso",
  sin_periodo: "sin_dato",
};

function subF29(m: F29EstadoMes, estado: EstadoFilaV06): string {
  if (estado === "declarado") {
    const folio = m.folio ? `folio ${m.folio}` : "sin folio";
    return m.saldo == null ? `${folio} · monto sin dato` : folio;
  }
  if (estado === "no_declarado_vencido") return "Vencido, no declarado según el SII";
  if (estado === "por_declarar") return "Aún no vence";
  if (estado === "en_curso") return "Período en curso";
  return "Sin dato, sincroniza tus F29 para ver el estado real";
}

/** Una fila por mes del `/f29/estado`. `estado === "sin_periodo"` (futuro sin período esperado) no
 *  produce fila — el caller lo filtra antes de llamar, igual que hace `f29-panel-view.tsx`. */
export function filaF29DeMes(
  m: F29EstadoMes,
  hoy: Date,
  estimacion?: EstimacionF29V06 | null,
): FilaCalendarioV06 {
  const estado = ESTADO_F29_MAP[m.estado] ?? "sin_dato";
  const declarado = estado === "declarado";
  const vencimiento = m.vencimiento ?? null;
  /* Declarado con `saldo` null = el SII declaró pero el backend no dejó el monto parseado (NO es
   *  $0). No declarado sólo recibe la estimación canónica del mismo período, ya filtrada arriba. */
  const estimacionDelPeriodo = !declarado && estimacion?.periodo === m.periodo ? estimacion : null;
  const montoEstimado = estimacionDelPeriodo?.monto ?? null;
  const motivoSinMonto = declarado
    ? m.saldo == null
      ? "El SII declaró este F-29 sin dejar el monto parseado."
      : null
    : (estimacionDelPeriodo?.motivoSinMonto ?? F29_ESTIMADO_MOTIVO);
  return {
    key: `f29-${m.periodo}`,
    concepto: "f29",
    label: `F-29 · ${formatPeriodLabel(m.periodo)}`,
    sub:
      montoEstimado == null
        ? subF29(m, estado)
        : `${subF29(m, estado)} · estimación, no declaración oficial`,
    estado,
    vencimiento,
    vencimientoLabel: venceLabelDe(vencimiento, hoy),
    dias: diasHasta(vencimiento, hoy),
    monto: declarado ? (m.saldo ?? null) : montoEstimado,
    moneda: "CLP",
    motivoSinMonto,
    resuelto: declarado,
    href: "/pagar/impuestos/f29",
    hrefLabel: declarado ? "Ver comprobante y desglose (SII)" : "Ver en el SII",
  };
}

/** Fila SEPARADA para el IVA postergado (código 755, ver cabecera "se muestra, no se ofrece").
 *  `null` si el mes no postergó o no trae la fecha diferida. */
export function filaF29PostergadoDeMes(m: F29EstadoMes, hoy: Date): FilaCalendarioV06 | null {
  if (m.postergado_iva !== true || !m.vencimiento_postergado) return null;
  const vencimiento = m.vencimiento_postergado;
  return {
    key: `f29-postergado-${m.periodo}`,
    concepto: "f29_postergado",
    label: `IVA postergado · ${formatPeriodLabel(m.periodo)}`,
    sub: "Postergación oficial del SII (código 755) · Qavante no la ofrece ni la mueve, sólo la muestra.",
    estado: "iva_postergado",
    vencimiento,
    vencimientoLabel: venceLabelDe(vencimiento, hoy),
    dias: diasHasta(vencimiento, hoy),
    monto: m.monto_postergado ?? null,
    moneda: "CLP",
    motivoSinMonto:
      m.monto_postergado == null
        ? "El SII declaró la postergación sin dejar el monto parseado."
        : null,
    resuelto: false,
    href: "/pagar/impuestos/f29",
    hrefLabel: "Ver en el SII",
  };
}

/* ── Previred ──────────────────────────────────────────────────────────────────────────────────── */

/** Fila de Previred del período (mismo monto que `previred-view.tsx`/V16 — Ley 1, `total_cotizaciones`
 *  de BUK). `totalCotizaciones`/`empleados` en `null` = sin planilla del período. No afirmamos si ya
 *  se pagó: el scraping de Previred no resuelve ese estado hoy (mismo hueco que `previred-view.tsx`). */
export function filaPreviredV06(
  period: string,
  totalCotizaciones: number | null,
  empleados: number | null,
  hoy: Date,
): FilaCalendarioV06 {
  const vencimiento = vencimientoPrevired(period);
  const sinPlanilla = totalCotizaciones == null;
  const n = empleados ?? 0;
  return {
    key: `previred-${period}`,
    concepto: "previred",
    label: `Previred · ${formatPeriodLabel(period)}`,
    sub: sinPlanilla
      ? "Sin planilla de BUK para este período."
      : `${n} ${concordar(n, "trabajador", "trabajadores")} · no leemos aún si ya se pagó`,
    estado: "previred_programado",
    vencimiento,
    vencimientoLabel: venceLabelDe(vencimiento, hoy),
    dias: diasHasta(vencimiento, hoy),
    monto: sinPlanilla ? null : totalCotizaciones,
    moneda: "CLP",
    motivoSinMonto: sinPlanilla ? "No hay planilla de BUK para este período." : null,
    resuelto: false,
    href: "/pagar/previred",
    hrefLabel: "Ver en Previred",
  };
}

/* ── TGR ───────────────────────────────────────────────────────────────────────────────────────── */

export type FuenteTgrV06 =
  | { estado: "ok"; movimientos: readonly TgrMovimiento[] }
  | { estado: "sin_dato" | "error"; motivo: string };

/** Sólo `estado="ok"` con una lista explícita puede afirmar "Sin deuda". Error, payload ausente y
 *  saldos/monedas ausentes conservan "sin dato"; nunca se convierten en cero. Cada deuda mantiene
 *  su moneda original y la vista la formatea sin conversión implícita. */
export function filasTgrV06(fuente: FuenteTgrV06, hoy: Date): FilaCalendarioV06[] {
  if (fuente.estado !== "ok") {
    return [
      {
        key: `tgr-${fuente.estado}`,
        concepto: "tgr",
        label: "TGR",
        sub: fuente.motivo,
        estado: "sin_dato",
        vencimiento: null,
        vencimientoLabel: "sin fecha",
        dias: null,
        monto: null,
        moneda: null,
        motivoSinMonto: fuente.motivo,
        resuelto: false,
        href: "/pagar/impuestos/tgr",
        hrefLabel: "Ver estado de TGR",
      },
    ];
  }

  const desconocidos = fuente.movimientos.filter(
    (m) => m.saldo == null || (m.saldo > 0 && normalizarMonedaTgr(m.moneda) == null),
  );
  const conDeuda = fuente.movimientos.filter(
    (m) => m.saldo != null && m.saldo > 0 && normalizarMonedaTgr(m.moneda) != null,
  );
  if (conDeuda.length === 0 && desconocidos.length === 0) {
    return [
      {
        key: "tgr-sin-deuda",
        concepto: "tgr",
        label: "TGR",
        sub: "Sin deudas fiscales vigentes.",
        estado: "tgr_sin_deuda",
        vencimiento: null,
        vencimientoLabel: "sin fecha",
        dias: null,
        monto: 0,
        moneda: "CLP",
        motivoSinMonto: null,
        resuelto: true,
        href: "/pagar/impuestos/tgr",
        hrefLabel: "Ver TGR",
      },
    ];
  }

  const filasConDeuda = conDeuda.map((m, i): FilaCalendarioV06 => {
    const vencimiento = m.fecha_vencimiento ?? null;
    const moneda = normalizarMonedaTgr(m.moneda)!;
    return {
      key: `tgr-${m.folio ?? i}`,
      concepto: "tgr" as const,
      label: `TGR · ${formularioLabelTgr(m.formulario)}`,
      sub: `${m.folio ? `Folio ${m.folio}` : "Sin folio"} · moneda ${moneda}`,
      estado: "tgr_deuda" as const,
      vencimiento,
      vencimientoLabel: venceLabelDe(vencimiento, hoy),
      dias: diasHasta(vencimiento, hoy),
      monto: m.saldo!,
      moneda,
      motivoSinMonto: null,
      resuelto: false,
      href: "/pagar/impuestos/tgr",
      hrefLabel: "Ver en TGR",
    };
  });
  const filasDesconocidas = desconocidos.map((m, i): FilaCalendarioV06 => {
    const vencimiento = m.fecha_vencimiento ?? null;
    const moneda = normalizarMonedaTgr(m.moneda);
    const motivo =
      m.saldo == null
        ? "TGR no informó el saldo de este giro."
        : "TGR informó el saldo, pero no su moneda; no lo interpretamos como CLP.";
    return {
      key: `tgr-sin-dato-${m.folio ?? i}`,
      concepto: "tgr",
      label: `TGR · ${formularioLabelTgr(m.formulario)}`,
      sub: m.folio ? `Folio ${m.folio}` : "Sin folio",
      estado: "sin_dato",
      vencimiento,
      vencimientoLabel: venceLabelDe(vencimiento, hoy),
      dias: diasHasta(vencimiento, hoy),
      monto: null,
      moneda,
      motivoSinMonto: motivo,
      resuelto: false,
      href: "/pagar/impuestos/tgr",
      hrefLabel: "Ver en TGR",
    };
  });
  return [...filasConDeuda, ...filasDesconocidas];
}

function normalizarMonedaTgr(moneda: string | null | undefined): string | null {
  const normalizada = moneda?.trim().toUpperCase() ?? "";
  return normalizada || null;
}

/* ── Ensamblado + orden ───────────────────────────────────────────────────────────────────────── */

export interface EntradaCalendarioV06 {
  mesesF29: readonly F29EstadoMes[];
  estimacionF29?: EstimacionF29V06 | null;
  previred: { period: string; totalCotizaciones: number | null; empleados: number | null } | null;
  tgr: FuenteTgrV06;
  hoy: Date;
}

/** Pendiente primero (más urgente primero, sin fecha al final), resuelto después (más reciente
 *  primero). Mismo criterio de "sin fecha al final" que `ordenarPorUrgencia` de Pagar V05. */
export function ordenarFilasV06(filas: readonly FilaCalendarioV06[]): FilaCalendarioV06[] {
  return [...filas].sort((a, b) => {
    if (a.resuelto !== b.resuelto) return a.resuelto ? 1 : -1;
    if (!a.resuelto) {
      if (a.dias == null && b.dias != null) return 1;
      if (a.dias != null && b.dias == null) return -1;
      if (a.dias != null && b.dias != null && a.dias !== b.dias) return a.dias - b.dias;
      return 0;
    }
    if (a.vencimiento && b.vencimiento) return b.vencimiento.localeCompare(a.vencimiento);
    if (a.vencimiento) return -1;
    if (b.vencimiento) return 1;
    return 0;
  });
}

/** Las filas del calendario, ya ordenadas — F-29 (+ su postergado si aplica) de la ventana de
 *  meses, Previred del período actual y TGR. */
export function filasCalendarioV06(entrada: EntradaCalendarioV06): FilaCalendarioV06[] {
  const filas: FilaCalendarioV06[] = [];
  for (const m of entrada.mesesF29) {
    if (m.estado === "sin_periodo") continue;
    filas.push(filaF29DeMes(m, entrada.hoy, entrada.estimacionF29));
    const postergado = filaF29PostergadoDeMes(m, entrada.hoy);
    if (postergado) filas.push(postergado);
  }
  if (entrada.previred) {
    filas.push(
      filaPreviredV06(
        entrada.previred.period,
        entrada.previred.totalCotizaciones,
        entrada.previred.empleados,
        entrada.hoy,
      ),
    );
  }
  filas.push(...filasTgrV06(entrada.tgr, entrada.hoy));
  return ordenarFilasV06(filas);
}

/* ── Ley 2: el único rojo ─────────────────────────────────────────────────────────────────────── */

/** La fila F-29 no declarada y vencida MÁS urgente (menor `dias`, o sea la más vieja) — el único
 *  candidato a rojo de la pantalla. `null` si no hay ninguna (nunca dos rojos a la vez). */
export function elUnicoRojoV06(filas: readonly FilaCalendarioV06[]): string | null {
  const vencidos = filas
    .filter((f) => f.estado === "no_declarado_vencido" && f.dias != null)
    .sort((a, b) => a.dias! - b.dias!);
  return vencidos[0]?.key ?? null;
}

/* ── (1) Tríada ───────────────────────────────────────────────────────────────────────────────── */

export interface ProximoVencimientoV06 {
  label: string;
  vencimientoLabel: string;
  relativoLabel: string;
  dias: number;
}

/** El vencimiento pendiente más urgente entre F-29/Previred/TGR (dias más chico, incluye vencido =
 *  negativo). `null` si ninguna fila pendiente trae fecha — el "no sé" del KPI. Deriva de `filas`
 *  (la MISMA lista que arma la tabla): el número de la tríada y la tabla nunca pueden divergir. */
export function proximoVencimientoV06(
  filas: readonly FilaCalendarioV06[],
  hoy: Date,
): ProximoVencimientoV06 | null {
  const pendientesConFecha = filas.filter((f) => !f.resuelto && f.dias != null);
  if (pendientesConFecha.length === 0) return null;
  const top = [...pendientesConFecha].sort((a, b) => a.dias! - b.dias!)[0]!;
  return {
    label: top.label,
    vencimientoLabel: top.vencimientoLabel,
    relativoLabel: formatRelative(top.vencimiento, hoy),
    dias: top.dias!,
  };
}

export interface TriadaTgrV06 {
  totales: { moneda: string; monto: number; n: number }[] | null;
  n: number;
  motivo: string | null;
  sinDeudaConfirmada: boolean;
}

/** Deuda TGR de la tríada, derivada de las MISMAS filas que la tabla (nunca un segundo cómputo
 *  paralelo sobre `movimientos` crudos — evita que la tríada y la tabla puedan mostrar números
 *  distintos del mismo concepto dentro de la propia pantalla). */
export function triadaTgrV06(filas: readonly FilaCalendarioV06[]): TriadaTgrV06 {
  const tgr = filas.filter((f) => f.concepto === "tgr");
  const sinDato = tgr.find((f) => f.estado === "sin_dato");
  if (sinDato) {
    return {
      totales: null,
      n: 0,
      motivo: sinDato.motivoSinMonto,
      sinDeudaConfirmada: false,
    };
  }
  const conDeuda = tgr.filter((f) => f.estado === "tgr_deuda");
  const porMoneda = new Map<string, { monto: number; n: number }>();
  for (const fila of conDeuda) {
    if (fila.monto == null || fila.moneda == null) continue;
    const total = porMoneda.get(fila.moneda) ?? { monto: 0, n: 0 };
    total.monto += fila.monto;
    total.n += 1;
    porMoneda.set(fila.moneda, total);
  }
  return {
    totales: [...porMoneda.entries()]
      .sort(([a], [b]) => (a === "CLP" ? -1 : b === "CLP" ? 1 : a.localeCompare(b)))
      .map(([moneda, total]) => ({ moneda, ...total })),
    n: conDeuda.length,
    motivo: null,
    sinDeudaConfirmada: conDeuda.length === 0,
  };
}

/* ── Exportar (§5.5): CSV del calendario ─────────────────────────────────────────────────────── */

function csvCampo(v: string | number | null): string {
  if (v == null) return "";
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvCalendarioV06(filas: readonly FilaCalendarioV06[]): string {
  return [
    ["concepto", "estado", "vencimiento", "dias", "monto", "moneda"].join(";"),
    ...filas.map((f) =>
      [
        csvCampo(f.label),
        csvCampo(ESTADO_LABEL_V06[f.estado]),
        f.vencimiento == null ? "sin fecha" : csvCampo(f.vencimiento),
        f.dias == null ? "sin fecha" : csvCampo(f.dias),
        f.monto == null ? "sin dato" : csvCampo(f.monto),
        f.moneda == null ? "sin dato" : csvCampo(f.moneda),
      ].join(";"),
    ),
  ].join("\n");
}
