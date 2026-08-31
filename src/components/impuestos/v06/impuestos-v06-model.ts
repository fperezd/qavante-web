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
 * ── EL RECORTE (issue #73): la estimación del F-29 del mes en curso NO se calcula ────────────────
 * La espec pide, para el mes que aún no se declara, "estimación y desglose IVA débito−crédito
 * (desde los DTEs)". Ese cálculo es R2 `[money]` — va por `qavante-api`, y su propia aceptación
 * exige contrastarlo contra un F-29 real declarado antes de publicarlo. Ese contraste no existe
 * todavía, así que este módulo NUNCA deriva ese número desde el RCV/DTE del mes: `f29EstimadoHuecoV06`
 * es una CONSTANTE (el motivo, no un cálculo), y toda fila del mes en curso/no declarado sale con
 * `monto: null` + `motivoSinMonto` citando esta misma razón — un hueco declarado, no un plausible.
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

import type { F29EstadoMes } from "@/lib/api/sii";
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

/* ── El motivo del recorte R2 (constante, no un cálculo — ver cabecera) ──────────────────────── */
export const F29_ESTIMADO_MOTIVO =
  "La estimación del F-29 del mes en curso (IVA débito menos crédito, desde tus DTEs) es un cálculo nuevo de qavante-api que primero debe contrastarse contra un F-29 real declarado — antes de eso no lo calculamos ni lo mostramos: un número plausible sin ese contraste sería peor que no tener número.";

export function f29EstimadoHuecoV06(): { reason: string } {
  return { reason: F29_ESTIMADO_MOTIVO };
}

const TGR_EN_PREPARACION_MOTIVO =
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
export function filaF29DeMes(m: F29EstadoMes, hoy: Date): FilaCalendarioV06 {
  const estado = ESTADO_F29_MAP[m.estado] ?? "sin_dato";
  const declarado = estado === "declarado";
  const vencimiento = m.vencimiento ?? null;
  /* Declarado con `saldo` null = el SII declaró pero el backend no dejó el monto parseado (NO es
   *  $0 — regla del handoff CC-API). No declarado = el hueco R2 (ver cabecera): nunca se estima. */
  const motivoSinMonto = declarado
    ? m.saldo == null
      ? "El SII declaró este F-29 sin dejar el monto parseado."
      : null
    : F29_ESTIMADO_MOTIVO;
  return {
    key: `f29-${m.periodo}`,
    concepto: "f29",
    label: `F-29 · ${formatPeriodLabel(m.periodo)}`,
    sub: subF29(m, estado),
    estado,
    vencimiento,
    vencimientoLabel: venceLabelDe(vencimiento, hoy),
    dias: diasHasta(vencimiento, hoy),
    monto: declarado ? (m.saldo ?? null) : null,
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
    sub: "Postergación oficial del SII (código 755) — Qavante no la ofrece ni la mueve, sólo la muestra.",
    estado: "iva_postergado",
    vencimiento,
    vencimientoLabel: venceLabelDe(vencimiento, hoy),
    dias: diasHasta(vencimiento, hoy),
    monto: m.monto_postergado ?? null,
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
    motivoSinMonto: sinPlanilla ? "No hay planilla de BUK para este período." : null,
    resuelto: false,
    href: "/pagar/previred",
    hrefLabel: "Ver en Previred",
  };
}

/* ── TGR ───────────────────────────────────────────────────────────────────────────────────────── */

/** Filas de TGR. `authenticated=false` (el estado de HOY para todo tenant, ver cabecera) produce
 *  UNA fila "sin dato" honesta en vez de omitir la fuente en silencio (Ley 8). Autenticado y sin
 *  deuda produce UNA fila "sin deuda" (cero real, no inventado — mismo criterio que
 *  `deudas-tgr-view.tsx`). Autenticado con deuda produce una fila por movimiento con saldo > 0. */
export function filasTgrV06(
  authenticated: boolean,
  movimientos: readonly TgrMovimiento[] | undefined,
  hoy: Date,
): FilaCalendarioV06[] {
  if (!authenticated) {
    return [
      {
        key: "tgr-sin-autenticar",
        concepto: "tgr",
        label: "TGR",
        sub: "En preparación: conectamos la Tesorería server-side.",
        estado: "sin_dato",
        vencimiento: null,
        vencimientoLabel: "sin fecha",
        dias: null,
        monto: null,
        motivoSinMonto: TGR_EN_PREPARACION_MOTIVO,
        resuelto: false,
        href: "/pagar/impuestos/tgr",
        hrefLabel: "Ver estado de TGR",
      },
    ];
  }

  const conDeuda = (movimientos ?? []).filter((m) => (m.saldo ?? 0) > 0);
  if (conDeuda.length === 0) {
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
        motivoSinMonto: null,
        resuelto: true,
        href: "/pagar/impuestos/tgr",
        hrefLabel: "Ver TGR",
      },
    ];
  }

  return conDeuda.map((m, i) => {
    const vencimiento = m.fecha_vencimiento ?? null;
    return {
      key: `tgr-${m.folio ?? i}`,
      concepto: "tgr" as const,
      label: `TGR · ${formularioLabelTgr(m.formulario)}`,
      sub: m.folio ? `Folio ${m.folio}` : "Sin folio",
      estado: "tgr_deuda" as const,
      vencimiento,
      vencimientoLabel: venceLabelDe(vencimiento, hoy),
      dias: diasHasta(vencimiento, hoy),
      monto: m.saldo ?? null,
      motivoSinMonto: m.saldo == null ? "TGR no informó el saldo de este giro." : null,
      resuelto: false,
      href: "/pagar/impuestos/tgr",
      hrefLabel: "Ver en TGR",
    };
  });
}

/* ── Ensamblado + orden ───────────────────────────────────────────────────────────────────────── */

export interface EntradaCalendarioV06 {
  mesesF29: readonly F29EstadoMes[];
  previred: { period: string; totalCotizaciones: number | null; empleados: number | null } | null;
  tgrAutenticado: boolean;
  tgrMovimientos: readonly TgrMovimiento[] | undefined;
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
    filas.push(filaF29DeMes(m, entrada.hoy));
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
  filas.push(...filasTgrV06(entrada.tgrAutenticado, entrada.tgrMovimientos, entrada.hoy));
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
  total: number | null;
  n: number;
  motivo: string | null;
}

/** Deuda TGR de la tríada, derivada de las MISMAS filas que la tabla (nunca un segundo cómputo
 *  paralelo sobre `movimientos` crudos — evita que la tríada y la tabla puedan mostrar números
 *  distintos del mismo concepto dentro de la propia pantalla). */
export function triadaTgrV06(filas: readonly FilaCalendarioV06[]): TriadaTgrV06 {
  const tgr = filas.filter((f) => f.concepto === "tgr");
  const sinAutenticar = tgr.find((f) => f.estado === "sin_dato");
  if (sinAutenticar) return { total: null, n: 0, motivo: sinAutenticar.motivoSinMonto };
  const conDeuda = tgr.filter((f) => f.estado === "tgr_deuda");
  return {
    total: conDeuda.reduce((s, f) => s + (f.monto ?? 0), 0),
    n: conDeuda.length,
    motivo: null,
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
    ["concepto", "estado", "vencimiento", "dias", "monto"].join(";"),
    ...filas.map((f) =>
      [
        csvCampo(f.label),
        csvCampo(ESTADO_LABEL_V06[f.estado]),
        f.vencimiento == null ? "sin fecha" : csvCampo(f.vencimiento),
        f.dias == null ? "sin fecha" : csvCampo(f.dias),
        f.monto == null ? "sin dato" : csvCampo(f.monto),
      ].join(";"),
    ),
  ].join("\n");
}
