import { exportTable, type ExportTable } from "@/lib/export/table";
/* V03 · Banco — el modelo PURO de la vista (rediseño Fase 2, issue #68).
 *
 * Contesta: "¿qué hay en mis cuentas y en qué estado está cada movimiento?".
 *
 * Sin React a propósito, como `hoy-model.ts` y `caja-v02-model.ts`: el estado de conexión, el
 * ciclo de vida de cada movimiento y los conteos de los filtros son afirmaciones que se fijan en
 * un test sin montar un DOM.
 *
 * LO QUE ESTE MÓDULO NO HACE, dicho acá:
 *   · No suma el saldo TOTAL de las cuentas para mostrarlo como "Caja hoy". Ese número sale de
 *     `cajaHoy()` (Ley 1, la misma función que V01 y V02). Lo que sí hace es SUMAR POR MONEDA los
 *     saldos que el banco informa (INV-FX-001: CLP y USD nunca se mezclan) y COMPARAR la suma CLP
 *     con `cajaHoy()` para declarar si coinciden — sin adivinar cuando falta uno de los dos.
 *   · No extrae la contraparte de la glosa. La spec dice que "el parser ya la saca", pero el
 *     `BankMovement` del OpenAPI no la trae como campo y en el front no existe tal parser
 *     (medido: cero funciones con ese nombre en `src/`). Inventar un recorte de la glosa sería un
 *     default plausible; la glosa va COMPLETA (Ley 7) y el hueco queda declarado.
 *   · No inventa el estado de una conexión: sin dato de `/api/sources/status` ni de `/api/bice/saldo`
 *     el estado es `sin_dato`, nunca "Conectada". */

import type {
  BankAccountItem,
  BankMovement,
  BiceAccount,
  CuentaSaldo,
  SaldoResponse,
  TarjetaCredito,
  TarjetaSaldoData,
  TarjetasResponse,
} from "@/lib/api/treasury";
import type { SourceStatus } from "@/lib/api/sources-status";
import type { CajaHoy } from "@/lib/finanzas/caja-hoy";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateShort, formatRelative } from "@/lib/formatters/date";
import { csv, csvCell } from "@/lib/export/csv";
import {
  connectionFailureMessage,
  sourceToConnectionCopy,
} from "@/components/conexiones/conexiones-copy";

/* ── Conexión ────────────────────────────────────────────────────────────────── */

/** Estado de la conexión con el banco, en los términos de la spec (§V03, pill de la cuenta).
 *  `sin_dato` es el bucket explícito del "no sé": no es "conectada" ni "caída". */
export type EstadoConexion =
  | "conectada"
  | "actualizando"
  | "desactualizada"
  | "accion_requerida"
  | "sin_conectar"
  | "sin_dato";

export interface ConexionBanco {
  estado: EstadoConexion;
  /** Texto del pill. */
  pill: string;
  /** Tono del pill. `warn` (ámbar) para lo que requiere acción: una integración caída es
   *  "requiere tu acción", no una emergencia de plata — el rojo se reserva (Ley 2). */
  tono: "ok" | "warn" | "mut";
  /** ISO de la última sincronización exitosa que se conoce, o `null`. */
  ultimaSync: string | null;
  /** Explicación segura para la persona usuaria, o `null`. Nunca contiene el error crudo. */
  motivo: string | null;
  /** Progreso que el backend pudo comprobar durante este sync, o `null` si no lo publicó. */
  progreso: { startedAt: string; etaSeconds: number | null } | null;
}

const PILL: Record<EstadoConexion, { pill: string; tono: ConexionBanco["tono"] }> = {
  conectada: { pill: "Conectada ✓", tono: "ok" },
  actualizando: { pill: "Actualizando", tono: "mut" },
  desactualizada: { pill: "Desactualizada", tono: "warn" },
  accion_requerida: { pill: "Tu acción", tono: "warn" },
  sin_conectar: { pill: "Sin conectar", tono: "mut" },
  sin_dato: { pill: "Sin dato de conexión", tono: "mut" },
};

/** ¿La respuesta de bice trae cuerpo de error (`status:"error"`, p.ej. `session_expired`)? El
 *  endpoint responde 200 igual, así que esto no se ve en `isError`. */
function errorDeBice(
  r: SaldoResponse | TarjetasResponse | null | undefined,
): { code: string | null; message: string | null } | null {
  if (!r || r.status !== "error") return null;
  const extra = r as { code?: unknown; message?: unknown; error?: unknown };
  return {
    code: typeof extra.code === "string" ? extra.code : null,
    message:
      typeof extra.message === "string"
        ? extra.message
        : typeof extra.error === "string"
          ? extra.error
          : null,
  };
}

/** La fuente de banco entre las fuentes del tenant. Por `category === "bank"`; si el agregado no
 *  trae categoría, por prefijo del código (`bank_*`, `bice`). */
export function fuenteBanco(
  sources: readonly SourceStatus[] | null | undefined,
): SourceStatus | null {
  if (!sources) return null;
  return (
    sources.find((s) => s.category === "bank") ??
    sources.find((s) => /^bank[_-]|^bice$/i.test(s.source)) ??
    null
  );
}

function progresoDe(fuente: SourceStatus | null): ConexionBanco["progreso"] {
  const progreso = fuente?.sync_progress;
  if (
    !progreso ||
    typeof progreso.started_at !== "string" ||
    Number.isNaN(Date.parse(progreso.started_at))
  ) {
    return null;
  }
  return {
    startedAt: progreso.started_at,
    etaSeconds:
      typeof progreso.eta_seconds === "number" &&
      Number.isFinite(progreso.eta_seconds) &&
      progreso.eta_seconds >= 0
        ? progreso.eta_seconds
        : null,
  };
}

/** El estado de la conexión, cruzando `/api/sources/status` con lo que respondió `/api/bice/*`.
 *
 *  Orden de precedencia, deliberado:
 *   1. bice respondió con cuerpo de error → `accion_requerida` aunque `sources` diga `ok` (el
 *      agregado puede ir atrasado; el error de la fuente es de ahora mismo).
 *   2. `sources`: error / unavailable-con-sync → `accion_requerida`; syncing → `actualizando`;
 *      stale → `desactualizada`; missing / unavailable-sin-sync → `sin_conectar`; ok → `conectada`.
 *   3. Sin fuente de banco y sin respuesta de bice → `sin_dato`. Nunca "Conectada" por defecto. */
export function conexionBanco(
  sources: readonly SourceStatus[] | null | undefined,
  saldo: SaldoResponse | null | undefined,
  tarjetas?: TarjetasResponse | null,
): ConexionBanco {
  const fuente = fuenteBanco(sources);
  const ultimaSync = fuente?.last_sync ?? saldo?.as_of ?? null;
  /* El error de TARJETAS sólo cuenta cuando el saldo no respondió: si `/api/bice/saldo` trae cuentas
     vivas y sólo `/tarjetas` falla (tenant sin tarjetas, endpoint caído), la conexión NO está caída y
     decir "Tu sesión no está disponible" sobre saldos vivos sería mentir. */
  const err = errorDeBice(saldo) ?? (saldo == null ? errorDeBice(tarjetas) : null);

  let estado: EstadoConexion;
  let motivo: string | null = fuente ? sourceToConnectionCopy(fuente).message : null;
  if (err) {
    estado = "accion_requerida";
    /* Un solo clasificador traduce la falla (Ley 1): acá no se vuelve a adivinar por código.
       Lo que no encaja en una señal documentada cae al bucket explícito de "no sabemos". */
    motivo = connectionFailureMessage(err.message);
  } else if (!fuente) {
    /* bice respondió cuentas pero el agregado no conoce la fuente: sabemos que responde, no
       sabemos su estado declarado. Con cuentas y sin error → conectada por evidencia directa. */
    estado =
      saldo && saldo.status !== "error" && (saldo.cuentas?.length ?? 0) > 0
        ? "conectada"
        : "sin_dato";
  } else {
    switch (fuente.state) {
      case "ok":
        estado = "conectada";
        break;
      case "syncing":
        estado = "actualizando";
        break;
      case "stale":
        estado = "desactualizada";
        break;
      case "error":
        estado = "accion_requerida";
        break;
      case "unavailable":
        estado = fuente.last_sync ? "accion_requerida" : "sin_conectar";
        break;
      case "missing":
        estado = "sin_conectar";
        break;
      default:
        estado = "sin_dato";
    }
  }
  return {
    estado,
    ...PILL[estado],
    ultimaSync,
    motivo,
    progreso: estado === "actualizando" ? progresoDe(fuente) : null,
  };
}

function duracionHumana(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
}

/** Texto de actualización: ETA sólo si lo publicó la integración; de otro modo, progreso real o
 * fallback explícitamente fijo para servidores aún sin `sync_progress`. */
export function textoActualizando(conexion: ConexionBanco, hoy: Date): string {
  const progreso = conexion.progreso;
  if (progreso?.etaSeconds != null) {
    return `trayendo la cartola… listo en ${duracionHumana(progreso.etaSeconds)}`;
  }
  if (progreso) {
    const transcurrido = Math.max(
      0,
      Math.floor((hoy.getTime() - Date.parse(progreso.startedAt)) / 1000),
    );
    return `trayendo la cartola… en curso hace ${duracionHumana(transcurrido)}; el banco no informó un tiempo estimado`;
  }
  return "trayendo la cartola… en curso; el banco no informó un tiempo estimado";
}

/** La frescura de una cuenta, en lenguaje humano, para el `.sub` (spec §V03). `hoy` explícito. */
export function frescuraCuenta(conexion: ConexionBanco, hoy: Date): string {
  const cuando = conexion.ultimaSync ? formatRelative(conexion.ultimaSync, hoy) : null;
  switch (conexion.estado) {
    case "actualizando":
      return textoActualizando(conexion, hoy);
    case "accion_requerida":
      return conexion.ultimaSync
        ? `desde el ${formatDateShort(conexion.ultimaSync)} no llegan movimientos`
        : "no llegan movimientos del banco";
    case "sin_conectar":
      return "banco sin conectar";
    case "sin_dato":
      return "sin dato de actualización";
    default:
      return cuando ? `actualizada ${cuando}` : "sin fecha de actualización";
  }
}

/* ── Cuentas ─────────────────────────────────────────────────────────────────── */

/** Una fila de la tabla de cuentas / tarjetas. */
export interface CuentaV03 {
  /** Clave estable de la fila. */
  key: string;
  /** "BICE · Cuenta Corriente CLP ···4567" — el nombre nunca trunca. */
  nombre: string;
  /** Frescura + pendientes, para el `.sub`. */
  sub: string;
  moneda: string;
  /** Saldo contable según el banco. `null` = NO SE SABE (bice no respondió): nunca `0`. */
  saldo: number | null;
  /** Por qué no hay saldo (cuando `saldo` es null). */
  saldoMotivo: string | null;
  /** Ruta al detalle (cartola / tarjeta), o `null` si no se puede llegar sin la sesión del banco. */
  href: string | null;
  /** Texto del link de acción. */
  accion: string;
  /** Movimientos por conciliar de esta cuenta (progreso, no alarma). `null` = no se pudo cruzar. */
  porConciliar: number | null;
  tipo: "cuenta" | "tarjeta";
}

/** Últimos 4 caracteres visibles de un número de cuenta / tarjeta: "···4567". */
export function parcial(numero: string | null | undefined): string {
  const limpio = (numero ?? "").replace(/\s/g, "");
  if (limpio.length === 0) return "";
  return `···${limpio.slice(-4)}`;
}

/** `bank_account_id` (Qavante) de una cuenta bice por su `numeroFormateado` (= `external_id`). */
export function bankAccountIdDe(
  links: readonly BiceAccount[] | null | undefined,
  numeroFormateado: string | null | undefined,
): string | null {
  if (!numeroFormateado) return null;
  return links?.find((l) => l.external_id === numeroFormateado)?.linked_bank_account_id ?? null;
}

function tipoCuenta(c: CuentaSaldo): string {
  const nombre = (c.nombreCuenta ?? "").trim();
  if (nombre) return nombre;
  return c.esExtranjera || (c.moneda ?? "").toUpperCase() === "USD"
    ? "Cuenta Corriente USD"
    : "Cuenta Corriente CLP";
}

function conPendientes(frescura: string, porConciliar: number | null): string {
  if (porConciliar == null || porConciliar === 0) return frescura;
  return `${frescura} · ${porConciliar} ${porConciliar === 1 ? "movimiento" : "movimientos"} por conciliar`;
}

export interface CuentasInput {
  banco: string;
  saldo: SaldoResponse | null | undefined;
  /** Cuentas Qavante (`/api/treasury/bank-accounts`), con las desactivadas: son las filas cuando bice
   *  no responde — la cuenta existe aunque el banco no conteste. */
  cuentasQavante: readonly BankAccountItem[] | null | undefined;
  links: readonly BiceAccount[] | null | undefined;
  conexion: ConexionBanco;
  /** `bank_account_id → movimientos por conciliar`. `null` = no se pudo contar. */
  pendientes: ReadonlyMap<string, number> | null;
  hoy: Date;
}

/** Las filas de CUENTAS CORRIENTES. Con bice vivo: una por cuenta del banco, con saldo. Con bice
 *  caído: una por cuenta Qavante del banco (`account_type` ≠ tarjeta), sin saldo y con el motivo. */
export function cuentasV03(input: CuentasInput): CuentaV03[] {
  const { banco, saldo, cuentasQavante, links, conexion, pendientes, hoy } = input;
  const frescura = frescuraCuenta(conexion, hoy);
  const bice = saldo && saldo.status !== "error" ? (saldo.cuentas ?? []) : [];

  if (bice.length > 0) {
    return bice.map((c) => {
      const moneda = (c.moneda ?? (c.esExtranjera ? "USD" : "CLP")).toUpperCase();
      const bankAccountId = bankAccountIdDe(links, c.numeroFormateado);
      const porConciliar =
        pendientes && bankAccountId ? (pendientes.get(bankAccountId) ?? 0) : null;
      const monto = parseAmountOrNull(c.saldoContable);
      return {
        key: `cuenta:${c.numeroCuenta}`,
        nombre: `${banco} · ${tipoCuenta(c)} ${parcial(c.numeroFormateado)}`.trim(),
        sub: conPendientes(frescura, porConciliar),
        moneda,
        saldo: monto,
        saldoMotivo: monto == null ? "El banco no informó el saldo contable de esta cuenta." : null,
        href: `/banco/cuenta/${encodeURIComponent(c.numeroCuenta)}`,
        accion: "cartola",
        porConciliar,
        tipo: "cuenta",
      };
    });
  }

  const motivo =
    conexion.estado === "accion_requerida"
      ? `No pudimos consultar el saldo: ${conexion.motivo ?? "la sesión con el banco no está disponible"}.`
      : conexion.estado === "actualizando"
        ? textoActualizando(conexion, hoy)
        : "El banco no respondió el saldo de esta cuenta.";
  return (cuentasQavante ?? [])
    .filter((a) => a.account_type !== "credit_card")
    .map((a) => {
      const porConciliar = pendientes ? (pendientes.get(a.id) ?? 0) : null;
      return {
        key: `qavante:${a.id}`,
        nombre: `${a.bank_name} · ${a.name}`.trim(),
        sub: conPendientes(frescura, porConciliar),
        moneda: (a.currency_code ?? "CLP").toUpperCase(),
        saldo: null,
        saldoMotivo: motivo,
        /* Sin el token de bice no hay detalle al que llegar: el link se omite en vez de mandar a
           una página que va a fallar (Ley 6: nada mudo). */
        href: null,
        accion: "cartola",
        porConciliar,
        tipo: "cuenta",
      };
    });
}

/** Las filas de TARJETAS DE CRÉDITO: una por moneda con cupo (CLP national / USD international).
 *  El "saldo" de una tarjeta es lo USADO del cupo, en negativo (es deuda), con apellido en la fila. */
export function tarjetasV03(
  banco: string,
  tarjetas: TarjetasResponse | null | undefined,
  saldoPorTarjeta: ReadonlyMap<string, TarjetaSaldoData>,
  conexion: ConexionBanco,
  hoy: Date,
): CuentaV03[] {
  const frescura = frescuraCuenta(conexion, hoy);
  const lista: TarjetaCredito[] =
    tarjetas && tarjetas.status !== "error" ? (tarjetas.data ?? []) : [];
  const out: CuentaV03[] = [];
  for (const t of lista) {
    const href = `/banco/tarjeta/${encodeURIComponent(t.operationNumber)}`;
    const base = `${banco} · ${(t.product ?? "Tarjeta de Crédito").trim()}`;
    const s = saldoPorTarjeta.get(t.operationNumber);
    const cupos: Array<[string, TarjetaSaldoData["national"]]> = [
      ["CLP", s?.national],
      ["USD", s?.international],
    ];
    const conDato = cupos.filter(([, c]) => c && typeof c.spentQuota === "number");
    if (conDato.length === 0) {
      out.push({
        key: `tarjeta:${t.operationNumber}`,
        nombre: `${base} ${parcial(t.operationNumber)}`,
        sub: frescura,
        moneda: "CLP",
        saldo: null,
        saldoMotivo:
          conexion.estado === "actualizando"
            ? textoActualizando(conexion, hoy)
            : "El banco no informó el cupo usado de esta tarjeta.",
        href,
        accion: "ver",
        porConciliar: null,
        tipo: "tarjeta",
      });
      continue;
    }
    for (const [moneda, c] of conDato) {
      out.push({
        key: `tarjeta:${t.operationNumber}:${moneda}`,
        nombre: `${base} ${moneda} ${parcial(t.operationNumber)}`,
        sub: `${frescura} · usado del cupo`,
        moneda,
        saldo: -(c!.spentQuota as number),
        saldoMotivo: null,
        href,
        accion: "ver",
        porConciliar: null,
        tipo: "tarjeta",
      });
    }
  }
  return out;
}

/** Suma de saldos POR MONEDA (INV-FX-001). Las filas sin saldo NO entran y se cuentan aparte:
 *  un total que las omite en silencio afirmaría "esto es todo" sobre cuentas que no se saben. */
export function sumaPorMoneda(filas: readonly CuentaV03[]): {
  porMoneda: Array<{ moneda: string; total: number; cuentas: number }>;
  sinSaldo: number;
} {
  const acc = new Map<string, { moneda: string; total: number; cuentas: number }>();
  let sinSaldo = 0;
  for (const f of filas) {
    if (f.tipo !== "cuenta") continue;
    if (f.saldo == null) {
      sinSaldo += 1;
      continue;
    }
    const b = acc.get(f.moneda) ?? { moneda: f.moneda, total: 0, cuentas: 0 };
    b.total += f.saldo;
    b.cuentas += 1;
    acc.set(f.moneda, b);
  }
  return {
    porMoneda: [...acc.values()].sort((a, b) => a.moneda.localeCompare(b.moneda)),
    sinSaldo,
  };
}

/* ── Ley 1 · "Caja hoy" vs. lo que informa el banco ──────────────────────────── */

export interface CuadreCajaHoy {
  /** El número de la vista: `cajaHoy()`. `null` = no se sabe. */
  cajaHoy: number | null;
  /** Suma de saldos contables CLP que el banco informa. `null` = ninguna cuenta CLP con saldo. */
  sumaBancoClp: number | null;
  /** `true`/`false` cuando se pudieron comparar; `null` cuando falta alguno de los dos. */
  coincide: boolean | null;
  /** Diferencia (banco − caja hoy) cuando ambos existen. */
  diferencia: number | null;
}

/** Compara "Caja hoy" (el saldo del resumen: apertura + movimientos importados) con la suma de
 *  saldos contables CLP que el banco informa en vivo. Son DOS conceptos con dos fuentes; la vista
 *  los muestra con apellido distinto y esta función dice, medido, si hoy coinciden. Cuando falta
 *  uno de los dos NO se afirma nada (`coincide: null`). */
export function cuadreCajaHoy(caja: CajaHoy, filas: readonly CuentaV03[]): CuadreCajaHoy {
  const clp = sumaPorMoneda(filas).porMoneda.find((m) => m.moneda === "CLP");
  const sumaBancoClp = clp ? clp.total : null;
  if (caja.monto == null || sumaBancoClp == null) {
    return { cajaHoy: caja.monto, sumaBancoClp, coincide: null, diferencia: null };
  }
  const diferencia = sumaBancoClp - caja.monto;
  return { cajaHoy: caja.monto, sumaBancoClp, coincide: Math.abs(diferencia) < 1, diferencia };
}

/** El chip de frescura del KPI "Caja hoy" (spec §V02/§V03: `BICE · 00:12 ✓`). Sin saldo o con saldo
 *  viejo el chip lo dice; el ✓ sólo va con `available`. */
export function chipCajaHoy(caja: CajaHoy, banco: string, hoy: Date): string {
  if (caja.monto == null) return `${banco} · sin saldo`;
  const cuando = caja.actualizado ? formatRelative(caja.actualizado, hoy) : "sin fecha";
  return caja.estado === "available" ? `${banco} · ${cuando} ✓` : `${banco} · ${cuando}`;
}

/* ── Movimientos ─────────────────────────────────────────────────────────────── */

/** Conciliación y clasificación son ejes independientes. Nunca colapsarlos en un único estado. */
export type EstadoConciliacionV03 =
  | "conciliado"
  | "parcial"
  | "pendiente"
  | "excluido"
  | "no_requerido";
export type EstadoClasificacionV03 = "clasificado" | "por_clasificar" | "revision";
/** Compatibilidad para consumidores antiguos; la UI nueva no usa este estado colapsado. */
export type CicloMovimiento = "conciliado" | "clasificado" | "por_clasificar";

export interface MovimientoV03 {
  id: string;
  bankAccountId: string;
  /** ISO `YYYY-MM-DD`. */
  fecha: string;
  /** La glosa COMPLETA del banco (Ley 7: nunca se trunca). */
  glosa: string;
  /** Etiqueta del documento conciliado publicada sólo para un vínculo efectivo 1:1.
   * No es contraparte bancaria ni se deriva de la glosa. */
  documentoConciliado?: string | null;
  /** Firmado: abono positivo, cargo negativo. El signo sale de `direction`, no del `amount`. */
  monto: number;
  moneda: string;
  esAbono: boolean;
  /** "CC CLP", "CC USD", "Tarjeta ···1234"… */
  cuenta: string;
  /** Etiqueta humana de la categoría, o `null` si no tiene. */
  categoria: string | null;
  estadoConciliacion: EstadoConciliacionV03;
  estadoClasificacion: EstadoClasificacionV03;
  /** Pendiente de conciliar (no está `matched` ni excluido). */
  porConciliar: boolean;
}

const CONCILIADO = new Set(["matched"]);
/** Estados que NO están pendientes pero tampoco son "conciliado con un documento". */
const NO_PENDIENTE = new Set(["excluded", "prepago", "processor_batch", "not_required"]);

type ReconciliationState = Pick<
  BankMovement,
  "reconciliation_status" | "effective_reconciliation_status"
>;

function reconciliationStatus(m: ReconciliationState): string {
  return (m.effective_reconciliation_status ?? m.reconciliation_status ?? "").toLowerCase();
}

/** ¿Está conciliado? Sólo `matched`. `suggested`/`review`/`rejected`/`unmatched` no lo están. */
export function estaConciliado(m: ReconciliationState): boolean {
  return CONCILIADO.has(reconciliationStatus(m));
}

/** ¿Queda por conciliar? Todo lo que no está conciliado ni excluido. */
export function quedaPorConciliar(m: ReconciliationState): boolean {
  const s = reconciliationStatus(m);
  return !CONCILIADO.has(s) && !NO_PENDIENTE.has(s);
}

/** ¿Está clasificado? El estado tiene que decirlo Y tiene que haber una categoría o una cuenta de
 *  gestión detrás: un `classified` sin ninguna de las dos no tiene nada que mostrar como
 *  "Clasificado ✓", y pintarlo así sería el pill afirmando lo que el dato no sostiene. */
export function estaClasificado(
  m: Pick<BankMovement, "classification_status" | "canonical_category" | "management_account_id">,
): boolean {
  const status = (m.classification_status ?? "").toLowerCase();
  const tieneCategoria = Boolean(m.canonical_category?.trim() || m.management_account_id?.trim());
  return status === "classified" && tieneCategoria;
}

export function estadoConciliacionDe(m: BankMovement): EstadoConciliacionV03 {
  const status = reconciliationStatus(m);
  if (status === "matched") return "conciliado";
  if (status === "partial" || status === "partially_matched") return "parcial";
  if (status === "excluded") return "excluido";
  if (status === "prepago" || status === "processor_batch" || status === "not_required") {
    return "no_requerido";
  }
  return "pendiente";
}

export function estadoClasificacionDe(m: BankMovement): EstadoClasificacionV03 {
  if (estaClasificado(m)) return "clasificado";
  const status = (m.classification_status ?? "").toLowerCase();
  return status === "needs_review" || status === "review" ? "revision" : "por_clasificar";
}

/** @deprecated Usar `estadoConciliacionDe` y `estadoClasificacionDe` por separado. */
export function cicloDe(m: BankMovement): CicloMovimiento {
  if (estaConciliado(m)) return "conciliado";
  return estaClasificado(m) ? "clasificado" : "por_clasificar";
}

/** Monto firmado por `direction` (contrato: `amount` viene POSITIVO y el signo lo da la dirección).
 *  Un `amount` ya negativo se respeta (payloads viejos). No numérico → `null`, no `0`. */
export function montoFirmado(m: Pick<BankMovement, "amount" | "direction">): number | null {
  const raw = parseAmountOrNull(m.amount);
  if (raw == null) return null;
  if (raw < 0) return raw;
  return m.direction === "debit" ? -raw : raw;
}

const TIPO_CORTO: Record<string, string> = {
  checking: "CC",
  savings: "Ahorro",
  credit_card: "Tarjeta",
  loan: "Crédito",
  investment: "Inversión",
};

/** "CC CLP" para el `.sub` del movimiento. Cuenta desconocida → "Cuenta ····1234" (los últimos 4 del
 *  id, como hace Por clasificar), nunca una moneda inventada. */
export function etiquetaCuenta(
  cuentas: ReadonlyMap<string, BankAccountItem>,
  bankAccountId: string,
): string {
  const a = cuentas.get(bankAccountId);
  if (!a) return `Cuenta ····${bankAccountId.slice(-4)}`;
  const tipo = TIPO_CORTO[a.account_type] ?? a.account_type;
  return `${tipo} ${(a.currency_code ?? "").toUpperCase()}`.trim();
}

export interface MovimientosInput {
  items: readonly BankMovement[];
  /** `id → cuenta Qavante` (con desactivadas, para no perder la moneda). */
  cuentas: ReadonlyMap<string, BankAccountItem>;
  /** `code → label` de las categorías canónicas. */
  categorias: ReadonlyMap<string, string>;
}

/** La API sólo publica este objeto para una conciliación efectiva 1:1. La UI no
 * infiere topología ni identidad desde `description`; un valor vacío queda ausente. */
export function documentoConciliadoDe(
  movement: Pick<BankMovement, "reconciliation_document">,
): string | null {
  return movement.reconciliation_document?.counterparty_label.trim() || null;
}

/** Normaliza los movimientos del backend. Los que no traen monto numérico se descartan: una fila sin
 *  monto no se puede filtrar por abono/cargo ni sumar, y pintarla como $0 sería inventarlo. Orden
 *  fecha desc (la regla de grillas del repo). */
export function movimientosV03(input: MovimientosInput): MovimientoV03[] {
  const out: MovimientoV03[] = [];
  for (const m of input.items) {
    const monto = montoFirmado(m);
    if (monto == null) continue;
    const cuenta = input.cuentas.get(m.bank_account_id);
    /* Moneda: la del movimiento o su cuenta. Si ambas faltan se declara desconocida; nunca se
       inventa CLP, y el drawer bloquea la escritura hasta corregir el dato de origen. */
    const moneda =
      (m.currency_code || cuenta?.currency_code)?.toUpperCase() || "Moneda no informada";
    const cat = m.canonical_category?.trim() || null;
    out.push({
      id: m.id,
      bankAccountId: m.bank_account_id,
      fecha: m.date,
      glosa: (m.description ?? "").trim() || "Sin glosa",
      documentoConciliado: documentoConciliadoDe(m),
      monto,
      moneda,
      esAbono: monto >= 0,
      cuenta: etiquetaCuenta(input.cuentas, m.bank_account_id),
      categoria: cat ? (input.categorias.get(cat) ?? cat) : null,
      estadoConciliacion: estadoConciliacionDe(m),
      estadoClasificacion: estadoClasificacionDe(m),
      porConciliar: quedaPorConciliar(m),
    });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** `bank_account_id → cuántos quedan por conciliar`, para el `.sub` de cada cuenta. */
export function pendientesPorCuenta(movs: readonly MovimientoV03[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of movs) {
    if (!m.porConciliar) continue;
    map.set(m.bankAccountId, (map.get(m.bankAccountId) ?? 0) + 1);
  }
  return map;
}

/* ── Búsqueda y filtros ──────────────────────────────────────────────────────── */

export type FiltroMovimientos = "todos" | "abonos" | "cargos";
export type FiltroConciliacion = "todos" | EstadoConciliacionV03;
export type FiltroClasificacion = "todos" | EstadoClasificacionV03;

/** Sólo dígitos (y K) de una consulta: "12.345.678-9" → "123456789", "$1.121.250" → "1121250". */
function soloDigitos(s: string): string {
  return s.replace(/[^0-9kK]/g, "").toLowerCase();
}

/** ¿El movimiento matchea la búsqueda? Por GLOSA (texto), por RUT (los dígitos de la consulta contra
 *  los dígitos de la glosa: "76.123.456-7", "76123456-7" y "761234567" encuentran lo mismo) y por
 *  MONTO (los dígitos de la consulta contra el monto absoluto redondeado). Vacío → todo pasa. */
export function coincideBusqueda(m: MovimientoV03, consulta: string): boolean {
  const q = consulta.trim().toLowerCase();
  if (q === "") return true;
  if (m.glosa.toLowerCase().includes(q)) return true;
  const digitos = soloDigitos(q);
  if (digitos.length < 3) return false;
  if (soloDigitos(m.glosa).includes(digitos)) return true;
  return String(Math.round(Math.abs(m.monto))).includes(digitos);
}

export function pasaFiltro(m: MovimientoV03, filtro: FiltroMovimientos): boolean {
  switch (filtro) {
    case "abonos":
      return m.esAbono;
    case "cargos":
      return !m.esAbono;
    default:
      return true;
  }
}

/** Los movimientos que pasan búsqueda + filtro. */
export function filtrarMovimientosV03(
  movs: readonly MovimientoV03[],
  filtro: FiltroMovimientos,
  consulta: string,
  conciliacion: FiltroConciliacion = "todos",
  clasificacion: FiltroClasificacion = "todos",
): MovimientoV03[] {
  return movs.filter(
    (m) =>
      coincideBusqueda(m, consulta) &&
      pasaFiltro(m, filtro) &&
      (conciliacion === "todos" || m.estadoConciliacion === conciliacion) &&
      (clasificacion === "todos" || m.estadoClasificacion === clasificacion),
  );
}

export interface ConteosMovimientos {
  todos: number;
  abonos: number;
  cargos: number;
  porConciliar: number;
}

/** Los conteos de los chips (spec §1.3: SIEMPRE con conteo), sobre el set que pasa la búsqueda —
 *  así "Por conciliar · N" es exactamente lo que se ve al pulsarlo. */
export function contarMovimientosV03(
  movs: readonly MovimientoV03[],
  consulta = "",
): ConteosMovimientos {
  const base = movs.filter((m) => coincideBusqueda(m, consulta));
  return {
    todos: base.length,
    abonos: base.filter((m) => m.esAbono).length,
    cargos: base.filter((m) => !m.esAbono).length,
    porConciliar: base.filter((m) => m.porConciliar).length,
  };
}

/** Totales del footer POR MONEDA (INV-FX-001): abonos, cargos y neto de lo filtrado. */
export function totalesPorMoneda(
  movs: readonly MovimientoV03[],
): Array<{ moneda: string; abonos: number; cargos: number; neto: number; n: number }> {
  const acc = new Map<
    string,
    { moneda: string; abonos: number; cargos: number; neto: number; n: number }
  >();
  for (const m of movs) {
    const b = acc.get(m.moneda) ?? { moneda: m.moneda, abonos: 0, cargos: 0, neto: 0, n: 0 };
    if (m.esAbono) b.abonos += m.monto;
    else b.cargos += m.monto;
    b.neto += m.monto;
    b.n += 1;
    acc.set(m.moneda, b);
  }
  return [...acc.values()].sort((a, b) => a.moneda.localeCompare(b.moneda));
}

/* ── Presentación de una fila ────────────────────────────────────────────────── */

export const CONCILIACION_PILL: Record<
  EstadoConciliacionV03,
  { texto: string; tono: "ok" | "warn" | "mut" }
> = {
  conciliado: { texto: "Conciliado ✓", tono: "ok" },
  parcial: { texto: "Parcial", tono: "warn" },
  pendiente: { texto: "Pendiente", tono: "warn" },
  excluido: { texto: "Excluido", tono: "mut" },
  no_requerido: { texto: "No requerido", tono: "mut" },
};

export const CLASIFICACION_PILL: Record<
  EstadoClasificacionV03,
  { texto: string; tono: "ok" | "warn" }
> = {
  clasificado: { texto: "Clasificado ✓", tono: "ok" },
  por_clasificar: { texto: "Sin clasificar", tono: "warn" },
  revision: { texto: "Revisar", tono: "warn" },
};

/** Ruta de entrada a la Bandeja V07, donde se resuelven las excepciones de clasificación. */
export function hrefClasificar(): string {
  return "/bandeja";
}

/** Monto con signo explícito: `+$6.000.000` / `−$66.222` (U+2212 lo pone `formatMoney`). */
export function montoConSigno(m: Pick<MovimientoV03, "monto" | "moneda">): string {
  const f = formatMoney(m.monto, m.moneda);
  return m.monto > 0 ? `+${f}` : f;
}

/** El `.sub` del movimiento: `21 ago · CC CLP · Impuestos`. Sin categoría lo dice. */
export function subMovimiento(m: MovimientoV03): string {
  const metadata = `${formatDateShort(m.fecha)} · ${m.cuenta} · ${m.categoria ?? "sin categoría"}`;
  return m.documentoConciliado
    ? `Documento conciliado · ${m.documentoConciliado} · ${metadata}`
    : metadata;
}

/* ── Exportar ────────────────────────────────────────────────────────────────── */

/** Movimientos filtrados con celdas tipadas para XLSX y CSV interoperable.
 * Monto firmado en crudo (sin formato) para que la planilla lo sume. */
export function csvMovimientosTable(movs: readonly MovimientoV03[]): ExportTable {
  return exportTable(
    ["fecha", "glosa", "cuenta", "categoria", "conciliacion", "clasificacion", "moneda", "monto"],
    movs.map((m) => [
      csvCell.date(m.fecha),
      csvCell.text(m.glosa),
      csvCell.text(m.cuenta),
      m.categoria == null ? csvCell.missing() : csvCell.text(m.categoria),
      csvCell.text(CONCILIACION_PILL[m.estadoConciliacion].texto.replace(" ✓", "")),
      csvCell.text(CLASIFICACION_PILL[m.estadoClasificacion].texto.replace(" ✓", "")),
      csvCell.text(m.moneda),
      csvCell.decimal(m.monto),
    ]),
  );
}

/** CSV interoperable: no contiene tipos de celda para Excel. */
export function csvMovimientos(movs: readonly MovimientoV03[]): string {
  const table = csvMovimientosTable(movs);
  return csv(table.headers, table.rows, table.dialect);
}
